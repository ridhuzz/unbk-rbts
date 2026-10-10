<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamLog;
use App\Models\Student;
use App\Services\ExamEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dashboard proktor: siapa yang sedang mengerjakan, reset, tambah waktu, paksa selesai.
 */
class ExamMonitorController extends Controller
{
    public function __construct(private readonly ExamEngine $engine)
    {
    }

    public function show(Exam $exam): Response
    {
        $exam->load(['questionBank.subject', 'grade', 'major']);

        return Inertia::render('admin/exams/monitor', [
            'exam' => [
                'id' => $exam->id,
                'name' => $exam->name,
                'subject' => $exam->questionBank->subject->name,
                'exam_date' => $exam->exam_date->format('Y-m-d'),
                'start_time' => substr($exam->start_time, 0, 5),
                'late_limit_time' => substr($exam->late_limit_time, 0, 5),
                'duration_minutes' => $exam->duration_minutes,
                'token' => $exam->token,
                'show_token' => $exam->show_token,
                'status' => $exam->status,
                'window' => $exam->windowState(),
                'grade' => $exam->grade?->code,
                'major' => $exam->major?->code,
                'session_no' => $exam->session_no,
            ],
            'snapshot' => $this->snapshot($exam),
        ]);
    }

    /**
     * Data live untuk polling.
     */
    public function data(Exam $exam): JsonResponse
    {
        return response()->json($this->snapshot($exam));
    }

    public function reset(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        $this->engine->reset($attempt, $request->user()->id);

        return back()->with('success', 'Sesi peserta direset. Peserta bisa login dan mulai lagi.');
    }

    public function addTime(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        $data = $request->validate(['minutes' => ['required', 'integer', 'min:1', 'max:180']]);
        if (!$attempt->isInProgress()) {
            return back()->with('error', 'Sesi sudah selesai.');
        }
        $this->engine->addTime($attempt, (int) $data['minutes'], $request->user()->id);

        return back()->with('success', "Waktu ditambah {$data['minutes']} menit.");
    }

    public function forceFinish(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        $this->engine->finish($attempt, ExamAttempt::STATUS_FORCE_FINISHED, 'user', $request->user()->id);

        return back()->with('success', 'Sesi peserta ditutup.');
    }

    /**
     * Buka kembali sesi yang sudah selesai (misal salah klik selesai).
     */
    public function reopen(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        $data = $request->validate(['minutes' => ['required', 'integer', 'min:1', 'max:300']]);
        $attempt->forceFill([
            'status' => ExamAttempt::STATUS_IN_PROGRESS,
            'finished_at' => null,
            'ends_at' => now()->addMinutes((int) $data['minutes']),
            'session_token' => \Illuminate\Support\Str::random(48),
        ])->save();
        ExamLog::record('reopen', $attempt, null, ['minutes' => $data['minutes']], 'user', $request->user()->id);

        return back()->with('success', 'Sesi dibuka kembali. Peserta harus login ulang.');
    }

    private function snapshot(Exam $exam): array
    {
        // tutup sesi yang kedaluwarsa agar status di dashboard akurat
        ExamAttempt::where('exam_id', $exam->id)
            ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
            ->where('ends_at', '<=', now())
            ->get()
            ->each(fn ($a) => $this->engine->finish($a, ExamAttempt::STATUS_FINISHED, 'system'));

        $eligible = $exam->eligibleStudents()
            ->with(['grade:id,code'])
            ->orderBy('name')
            ->get();

        $attempts = ExamAttempt::where('exam_id', $exam->id)
            ->withCount(['answers as answered_count' => fn ($q) => $q->where(fn ($w) => $w->whereNotNull('answer')->orWhereNotNull('essay_answer'))])
            ->withCount('answers')
            ->get()->keyBy('student_id');

        $idleMinutes = (int) \App\Models\Setting::get('idle_minutes', 5);

        $rows = $eligible->map(function (Student $s) use ($attempts, $idleMinutes) {
            $a = $attempts->get($s->id);

            return [
                'student_id' => $s->id,
                'exam_number' => $s->exam_number,
                'name' => $s->name,
                'grade' => $s->grade?->code,
                'class_name' => $s->class_name,
                'attempt_id' => $a?->id,
                'status' => $a?->status ?? 'not_started',
                'started_at' => $a?->started_at?->toIso8601String(),
                'ends_at' => $a?->ends_at?->toIso8601String(),
                'finished_at' => $a?->finished_at?->toIso8601String(),
                'last_seen_at' => $a?->last_seen_at?->toIso8601String(),
                'is_idle' => $a && $a->isInProgress() && $a->last_seen_at && $a->last_seen_at->lt(now()->subMinutes($idleMinutes)),
                'ip_address' => $a?->ip_address,
                'answered' => $a?->answered_count ?? 0,
                'total' => $a?->answers_count ?? 0,
                'remaining_seconds' => $a?->remainingSeconds() ?? 0,
                'extra_minutes' => $a?->extra_minutes ?? 0,
                'total_score' => $a?->total_score,
            ];
        })->values();

        return [
            'server_time' => now()->toIso8601String(),
            'summary' => [
                'eligible' => $rows->count(),
                'not_started' => $rows->where('status', 'not_started')->count(),
                'in_progress' => $rows->where('status', ExamAttempt::STATUS_IN_PROGRESS)->count(),
                'finished' => $rows->whereIn('status', [ExamAttempt::STATUS_FINISHED, ExamAttempt::STATUS_FORCE_FINISHED])->count(),
            ],
            'participants' => $rows,
            'logs' => ExamLog::where('exam_id', $exam->id)->latest('created_at')->limit(30)->get()
                ->map(fn ($l) => [
                    'id' => $l->id, 'event' => $l->event, 'actor_type' => $l->actor_type,
                    'attempt_id' => $l->exam_attempt_id, 'meta' => $l->meta, 'created_at' => $l->created_at->toIso8601String(),
                ]),
        ];
    }
}
