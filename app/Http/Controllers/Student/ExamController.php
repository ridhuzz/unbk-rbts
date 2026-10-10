<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Services\ExamEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ExamController extends Controller
{
    public function __construct(private readonly ExamEngine $engine)
    {
    }

    /**
     * Halaman konfirmasi: data peserta + ujian yang tersedia hari ini + input token.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        $student = $this->student($request);

        // sesi yang masih berjalan -> langsung lanjut
        $running = $this->runningAttempt($student);
        if ($running) {
            return redirect()->route('siswa.ujian.kerjakan');
        }

        $exams = Exam::forStudent($student)->with('questionBank.subject')->get();
        $attempts = ExamAttempt::where('student_id', $student->id)
            ->whereIn('exam_id', $exams->pluck('id'))
            ->get()->keyBy('exam_id');

        return Inertia::render('siswa/konfirmasi', [
            'school' => AuthController::school(),
            'student' => $this->studentPayload($student),
            'server_time' => now()->toIso8601String(),
            'exams' => $exams->map(function (Exam $e) use ($attempts) {
                $a = $attempts->get($e->id);

                return [
                    'id' => $e->id,
                    'name' => $e->name,
                    'subject' => $e->questionBank->subject->name,
                    'exam_date' => $e->exam_date->format('Y-m-d'),
                    'start_time' => substr($e->start_time, 0, 5),
                    'late_limit_time' => substr($e->late_limit_time, 0, 5),
                    'duration_minutes' => $e->duration_minutes,
                    'total_questions' => $e->totalQuestions(),
                    'window' => $e->windowState(),
                    'show_token' => $e->show_token,
                    'token_hint' => $e->show_token ? $e->token : null,
                    'attempt_status' => $a?->status,
                    'score' => $e->resultsPublished() ? $a?->total_score : null,
                    'instructions' => $e->instructions,
                ];
            })->values(),
            'history' => ExamAttempt::where('student_id', $student->id)
                ->whereIn('status', [ExamAttempt::STATUS_FINISHED, ExamAttempt::STATUS_FORCE_FINISHED])
                ->with('exam.questionBank.subject')
                ->orderByDesc('finished_at')->limit(20)->get()
                ->map(fn (ExamAttempt $a) => [
                    'id' => $a->id,
                    'exam' => $a->exam->name,
                    'subject' => $a->exam->questionBank->subject->name,
                    'exam_date' => $a->exam->exam_date->format('Y-m-d'),
                    'finished_at' => $a->finished_at?->toIso8601String(),
                    'published' => $a->exam->resultsPublished(),
                    'score' => $a->exam->resultsPublished() ? $a->total_score : null,
                    'correct' => $a->exam->resultsPublished() ? $a->correct_count : null,
                    'total' => $a->exam->totalQuestions(),
                ])->values(),
        ]);
    }

    /**
     * Verifikasi token lalu mulai / lanjutkan sesi.
     */
    public function start(Request $request): RedirectResponse
    {
        $student = $this->student($request);
        $data = $request->validate([
            'exam_id' => ['required', 'integer'],
            'token' => ['required', 'string', 'max:10'],
        ]);

        $exam = Exam::forStudent($student)->whereKey($data['exam_id'])->first();
        if (!$exam) {
            throw ValidationException::withMessages(['exam_id' => 'Ujian tidak tersedia untuk Anda.']);
        }
        if (strtoupper(trim($data['token'])) !== strtoupper($exam->token)) {
            throw ValidationException::withMessages(['token' => 'Token ujian salah. Minta token ke proktor.']);
        }

        $attempt = $this->engine->start($exam, $student, $request->ip(), $request->userAgent());
        $request->session()->put('attempt_token', $attempt->session_token);

        return redirect()->route('siswa.ujian.kerjakan');
    }

    /**
     * Halaman pengerjaan.
     */
    public function work(Request $request): Response|RedirectResponse
    {
        $student = $this->student($request);
        $attempt = $this->currentAttempt($request, $student);
        if (!$attempt) {
            return redirect()->route('siswa.ujian.index');
        }

        $attempt = $this->engine->finishIfExpired($attempt);
        if ($attempt->isFinished()) {
            return redirect()->route('siswa.ujian.selesai', $attempt);
        }

        return Inertia::render('siswa/ujian', [
            'school' => AuthController::school(),
            'student' => $this->studentPayload($student),
        ] + $this->engine->payload($attempt));
    }

    /**
     * Simpan jawaban (AJAX JSON).
     */
    public function answer(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $attempt = $this->currentAttempt($request, $student);
        abort_if(!$attempt, 409, 'Sesi ujian tidak ditemukan.');

        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'answer' => ['nullable', 'string', 'size:1'],
            'essay_answer' => ['nullable', 'string', 'max:20000'],
            'is_doubtful' => ['nullable', 'boolean'],
        ]);

        $result = $this->engine->answer(
            $attempt,
            (int) $data['question_id'],
            $data['answer'] ?? null,
            array_key_exists('essay_answer', $data) ? ($data['essay_answer'] ?? '') : null,
            array_key_exists('is_doubtful', $data) ? (bool) $data['is_doubtful'] : null,
        );

        return response()->json($result + [
            'remaining_seconds' => $attempt->fresh()->remainingSeconds(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Sinkronisasi timer / heartbeat (AJAX JSON).
     */
    public function status(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $attempt = ExamAttempt::where('student_id', $student->id)->latest('started_at')->first();
        if (!$attempt) {
            return response()->json(['status' => 'none'], 409);
        }
        $attempt = $this->engine->finishIfExpired($attempt);
        if ($attempt->isFinished()) {
            // waktu habis atau ditutup proktor: beri tahu klien ke mana harus pergi
            $request->session()->forget('attempt_token');

            return response()->json([
                'status' => $attempt->status,
                'remaining_seconds' => 0,
                'redirect' => route('siswa.ujian.selesai', $attempt),
                'server_time' => now()->toIso8601String(),
            ]);
        }
        if ($request->session()->get('attempt_token') !== $attempt->session_token) {
            return response()->json(['status' => 'none'], 409);
        }
        $this->engine->touch($attempt);

        return response()->json([
            'status' => $attempt->status,
            'remaining_seconds' => $attempt->remainingSeconds(),
            'ends_at' => $attempt->ends_at->toIso8601String(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function finish(Request $request): RedirectResponse|JsonResponse
    {
        $student = $this->student($request);
        $attempt = $this->currentAttempt($request, $student);
        abort_if(!$attempt, 409, 'Sesi ujian tidak ditemukan.');

        $attempt = $this->engine->finish($attempt, ExamAttempt::STATUS_FINISHED, 'student', $student->id);
        $request->session()->forget('attempt_token');

        if ($request->wantsJson()) {
            return response()->json(['redirect' => route('siswa.ujian.selesai', $attempt)]);
        }

        return redirect()->route('siswa.ujian.selesai', $attempt);
    }

    public function finished(Request $request, ExamAttempt $attempt): Response
    {
        $student = $this->student($request);
        abort_unless($attempt->student_id === $student->id, 403);
        $attempt->loadMissing('exam.questionBank.subject');

        return Inertia::render('siswa/selesai', [
            'school' => AuthController::school(),
            'student' => $this->studentPayload($student),
            'exam' => [
                'name' => $attempt->exam->name,
                'subject' => $attempt->exam->questionBank->subject->name,
            ],
            'attempt' => [
                'status' => $attempt->status,
                'started_at' => $attempt->started_at->toIso8601String(),
                'finished_at' => $attempt->finished_at?->toIso8601String(),
                'answered' => $attempt->answers()->where(fn ($q) => $q->whereNotNull('answer')->orWhereNotNull('essay_answer'))->count(),
                'total' => $attempt->answers()->count(),
                // nilai hanya tampil setelah admin/guru mempublikasikan hasil
                'published' => $attempt->exam->resultsPublished(),
                'score' => $attempt->exam->resultsPublished() ? $attempt->total_score : null,
                'correct' => $attempt->exam->resultsPublished() ? $attempt->correct_count : null,
            ],
        ]);
    }

    // ---------------------------------------------------------------

    private function student(Request $request): Student
    {
        return $request->user('student');
    }

    private function runningAttempt(Student $student): ?ExamAttempt
    {
        $attempt = ExamAttempt::where('student_id', $student->id)
            ->where('status', ExamAttempt::STATUS_IN_PROGRESS)
            ->latest('started_at')
            ->first();

        if ($attempt) {
            $attempt = $this->engine->finishIfExpired($attempt);
        }

        return $attempt && $attempt->isInProgress() ? $attempt : null;
    }

    /**
     * Sesi aktif milik peserta ini, dicocokkan dengan token sesi di session browser
     * (mencegah dua browser mengerjakan sesi yang sama).
     */
    private function currentAttempt(Request $request, Student $student): ?ExamAttempt
    {
        $attempt = $this->runningAttempt($student);
        if (!$attempt) {
            return null;
        }
        $token = $request->session()->get('attempt_token');
        if ($token !== $attempt->session_token) {
            Auth::guard('student')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $message = 'Sesi ujian dibuka dari perangkat lain atau direset proktor. Silakan login kembali.';
            if ($request->wantsJson()) {
                abort(409, $message);
            }
            throw new HttpResponseException(redirect()->route('siswa.login')->with('error', $message));
        }

        return $attempt;
    }

    private function studentPayload(Student $student): array
    {
        $student->loadMissing(['grade', 'major', 'gradeLevel.level']);

        return [
            'id' => $student->id,
            'exam_number' => $student->exam_number,
            'name' => $student->name,
            'gender' => $student->gender,
            'tingkat' => $student->gradeLevel ? "{$student->gradeLevel->level->code} {$student->gradeLevel->number}" : null,
            'grade' => $student->grade?->code,
            'major' => $student->major?->code,
            'class_name' => $student->class_name,
            'session_no' => $student->session_no,
            'photo' => $student->photo ? asset('storage/' . $student->photo) : null,
        ];
    }
}
