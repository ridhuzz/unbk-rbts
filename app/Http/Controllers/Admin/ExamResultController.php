<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttemptAnswer;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamLog;
use App\Models\Question;
use App\Services\ExamEngine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExamResultController extends Controller
{
    public function __construct(private readonly ExamEngine $engine)
    {
    }

    /**
     * Rekap nilai + analisis butir per ujian.
     */
    public function show(Exam $exam): Response
    {
        $exam->load('questionBank.subject');
        $attempts = $this->attempts($exam);

        return Inertia::render('admin/exams/results', [
            'exam' => [
                'id' => $exam->id,
                'name' => $exam->name,
                'subject' => $exam->questionBank->subject->name,
                'exam_date' => $exam->exam_date->format('Y-m-d'),
                'mc_count' => $exam->mc_count,
                'essay_count' => $exam->essay_count,
                'status' => $exam->status,
                'results_published_at' => $exam->results_published_at?->toIso8601String(),
            ],
            'results' => $attempts->map(fn (ExamAttempt $a) => $this->row($a)),
            'class_recap' => $attempts->groupBy(fn (ExamAttempt $a) => $a->student->grade?->code ?? $a->student->class_name ?? '-')
                ->map(fn ($rows, $grade) => [
                    'grade' => $grade,
                    'count' => $rows->count(),
                    'finished' => $rows->filter(fn ($a) => $a->isFinished())->count(),
                    'avg' => round((float) $rows->whereNotNull('total_score')->avg('total_score'), 2),
                    'max' => (float) $rows->max('total_score'),
                    'min' => (float) $rows->whereNotNull('total_score')->min('total_score'),
                ])->sortBy('grade')->values(),
            'summary' => [
                'count' => $attempts->count(),
                'avg' => round((float) $attempts->avg('total_score'), 2),
                'max' => (float) $attempts->max('total_score'),
                'min' => (float) $attempts->min('total_score'),
                'pending_essays' => AttemptAnswer::whereIn('exam_attempt_id', $attempts->pluck('id'))
                    ->whereHas('question', fn ($q) => $q->where('type', Question::TYPE_ESSAY))
                    ->whereNotNull('essay_answer')->whereNull('essay_score')->count(),
            ],
            'item_analysis' => $this->itemAnalysis($exam, $attempts),
        ]);
    }

    /**
     * Publikasikan / tarik kembali hasil agar peserta bisa (atau tidak bisa) melihat nilainya.
     */
    public function publish(Request $request, Exam $exam): RedirectResponse
    {
        $data = $request->validate(['published' => ['required', 'boolean']]);
        if ($data['published']) {
            $pending = AttemptAnswer::whereHas('attempt', fn ($q) => $q->where('exam_id', $exam->id))
                ->whereHas('question', fn ($q) => $q->where('type', Question::TYPE_ESSAY))
                ->whereNotNull('essay_answer')->whereNull('essay_score')->count();
            if ($pending > 0) {
                return back()->with('error', "Masih ada {$pending} jawaban esai yang belum dinilai. Selesaikan koreksi sebelum publikasi.");
            }
            $exam->update(['results_published_at' => now()]);
            ExamLog::record('results:published', null, $exam, [], 'user', $request->user()->id);

            return back()->with('success', 'Hasil dipublikasikan. Peserta bisa melihat nilainya.');
        }
        $exam->update(['results_published_at' => null]);
        ExamLog::record('results:unpublished', null, $exam, [], 'user', $request->user()->id);

        return back()->with('success', 'Publikasi hasil ditarik kembali.');
    }

    /**
     * Detail jawaban satu peserta (lembar jawaban).
     */
    public function attempt(Exam $exam, ExamAttempt $attempt): Response
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        $attempt->load(['student.grade', 'answers.question', 'exam.questionBank.subject']);

        return Inertia::render('admin/exams/attempt', [
            'exam' => ['id' => $exam->id, 'name' => $exam->name, 'subject' => $exam->questionBank->subject->name],
            'attempt' => $this->row($attempt) + [
                'started_at' => $attempt->started_at->toIso8601String(),
                'finished_at' => $attempt->finished_at?->toIso8601String(),
                'ip_address' => $attempt->ip_address,
            ],
            'answers' => $attempt->answers->map(fn (AttemptAnswer $a) => [
                'id' => $a->id,
                'position' => $a->position,
                'number' => $a->question->number,
                'type' => $a->question->type,
                'body' => $a->question->body,
                'image' => $a->question->image ? asset('storage/' . $a->question->image) : null,
                'options' => collect($a->question->options ?? [])->map(fn ($o) => [
                    'key' => $o['key'], 'body' => $o['body'] ?? '',
                    'image' => !empty($o['image']) ? asset('storage/' . $o['image']) : null,
                ])->values(),
                'answer' => $a->answer,
                'answer_key' => $a->question->answer_key,
                'is_correct' => $a->is_correct,
                'essay_answer' => $a->essay_answer,
                'essay_score' => $a->essay_score,
                'is_doubtful' => $a->is_doubtful,
                'answered_at' => $a->answered_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Simpan nilai esai, lalu hitung ulang nilai peserta.
     */
    public function gradeEssay(Request $request, Exam $exam, ExamAttempt $attempt): RedirectResponse
    {
        abort_unless($attempt->exam_id === $exam->id, 404);
        if ($exam->resultsPublished()) {
            return back()->with('error', 'Hasil sudah dipublikasikan. Tarik publikasi dulu sebelum mengubah nilai esai.');
        }
        $data = $request->validate([
            'scores' => ['present', 'array'],
            'scores.*' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
        foreach ($data['scores'] as $answerId => $score) {
            AttemptAnswer::where('exam_attempt_id', $attempt->id)->whereKey($answerId)
                ->update(['essay_score' => $score, 'graded_by' => $request->user()->id]);
        }
        $this->engine->grade($attempt);

        return back()->with('success', 'Nilai esai disimpan.');
    }

    public function regrade(Request $request, Exam $exam): RedirectResponse
    {
        if ($exam->resultsPublished()) {
            return back()->with('error', 'Hasil sudah dipublikasikan. Tarik publikasi dulu sebelum menghitung ulang.');
        }
        $this->attempts($exam)->each(fn ($a) => $this->engine->grade($a));
        ExamLog::record('regrade', null, $exam, [], 'user', $request->user()->id);

        return back()->with('success', 'Nilai dihitung ulang.');
    }

    public function export(Exam $exam): StreamedResponse
    {
        $exam->load('questionBank.subject');
        $attempts = $this->attempts($exam);
        $filename = 'nilai-' . \Illuminate\Support\Str::slug($exam->name) . '.csv';

        return response()->streamDownload(function () use ($attempts, $exam) {
            $out = fopen('php://output', 'w');
            fprintf($out, "\xEF\xBB\xBF"); // BOM agar Excel membaca UTF-8
            fputcsv($out, ['Ujian', $exam->name, 'Mapel', $exam->questionBank->subject->name, 'Tanggal', $exam->exam_date->format('Y-m-d')], ';');
            fputcsv($out, ['No', 'Nomor Peserta', 'Nama', 'Kelas', 'Benar', 'Salah', 'Kosong', 'Nilai PG', 'Nilai Esai', 'Nilai Akhir', 'Status', 'Mulai', 'Selesai'], ';');
            foreach ($attempts as $i => $a) {
                fputcsv($out, [
                    $i + 1, $a->student->exam_number, $a->student->name, $a->student->grade?->code ?? $a->student->class_name,
                    $a->correct_count, $a->wrong_count, $a->unanswered_count,
                    $a->score_mc, $a->score_essay, $a->total_score, $a->status,
                    $a->started_at?->format('Y-m-d H:i'), $a->finished_at?->format('Y-m-d H:i'),
                ], ';');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function attempts(Exam $exam)
    {
        return ExamAttempt::where('exam_id', $exam->id)
            ->with(['student:id,exam_number,name,grade_id,class_name', 'student.grade:id,code'])
            ->orderByDesc('total_score')->orderBy('student_id')->get();
    }

    private function row(ExamAttempt $a): array
    {
        return [
            'id' => $a->id,
            'student_id' => $a->student_id,
            'exam_number' => $a->student->exam_number,
            'name' => $a->student->name,
            'grade' => $a->student->grade?->code,
            'class_name' => $a->student->class_name,
            'status' => $a->status,
            'correct_count' => $a->correct_count,
            'wrong_count' => $a->wrong_count,
            'unanswered_count' => $a->unanswered_count,
            'score_mc' => $a->score_mc,
            'score_essay' => $a->score_essay,
            'total_score' => $a->total_score,
            'finished_at' => $a->finished_at?->toIso8601String(),
        ];
    }

    /**
     * Analisis butir: persentase benar & sebaran pilihan tiap soal.
     */
    private function itemAnalysis(Exam $exam, $attempts): array
    {
        if ($attempts->isEmpty()) {
            return [];
        }
        $rows = AttemptAnswer::whereIn('exam_attempt_id', $attempts->pluck('id'))
            ->with('question:id,number,type,answer_key')
            ->get()
            ->groupBy('question_id');

        return $rows->map(function ($answers, $qid) {
            $q = $answers->first()->question;
            $dist = $answers->whereNotNull('answer')->countBy('answer')->sortKeys();

            return [
                'question_id' => $qid,
                'number' => $q->number,
                'type' => $q->type,
                'answer_key' => $q->answer_key,
                'attempts' => $answers->count(),
                'correct' => $answers->where('is_correct', true)->count(),
                'correct_pct' => $answers->count() ? round($answers->where('is_correct', true)->count() / $answers->count() * 100, 1) : 0,
                'unanswered' => $answers->whereNull('answer')->whereNull('essay_answer')->count(),
                'distribution' => $dist->all(),
                'avg_essay' => $q->type === Question::TYPE_ESSAY ? round((float) $answers->whereNotNull('essay_score')->avg('essay_score'), 2) : null,
            ];
        })->sortBy('number')->values()->all();
    }
}
