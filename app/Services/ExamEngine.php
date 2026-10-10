<?php

namespace App\Services;

use App\Models\AttemptAnswer;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamLog;
use App\Models\Question;
use App\Models\Student;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Mesin ujian: memulai sesi, menyimpan jawaban, menilai, dan menutup sesi.
 * Semua aturan waktu dan kunci jawaban hidup di sini, tidak pernah di browser.
 */
class ExamEngine
{
    /**
     * Mulai (atau lanjutkan) sesi ujian untuk peserta.
     */
    public function start(Exam $exam, Student $student, string $ip, ?string $userAgent = null): ExamAttempt
    {
        return DB::transaction(function () use ($exam, $student, $ip, $userAgent) {
            $existing = ExamAttempt::where('exam_id', $exam->id)
                ->where('student_id', $student->id)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                if ($existing->isFinished()) {
                    throw ValidationException::withMessages(['exam' => 'Ujian ini sudah Anda selesaikan.']);
                }
                $existing->forceFill([
                    'session_token' => Str::random(48),
                    'ip_address' => $ip,
                    'user_agent' => Str::limit((string) $userAgent, 250, ''),
                    'last_seen_at' => now(),
                ])->save();
                ExamLog::record('resume', $existing, $exam, ['ip' => $ip], 'student', $student->id);

                return $existing;
            }

            if ($exam->windowState() !== 'open') {
                throw ValidationException::withMessages(['exam' => 'Waktu masuk ujian sudah ditutup atau belum dibuka.']);
            }

            $questions = $this->pickQuestions($exam);
            if ($questions->isEmpty()) {
                throw ValidationException::withMessages(['exam' => 'Bank soal untuk ujian ini masih kosong.']);
            }

            $now = now();
            $minutes = $exam->duration_minutes;
            if ($exam->late_policy === 'reduced') {
                // waktu dihitung dari jam mulai resmi, bukan dari jam peserta masuk
                $elapsed = (int) $exam->startsAt()->diffInMinutes($now, false);
                $minutes = max(1, $minutes - max(0, $elapsed));
            }

            try {
                $attempt = ExamAttempt::create([
                    'exam_id' => $exam->id,
                    'student_id' => $student->id,
                    'session_token' => Str::random(48),
                    'started_at' => $now,
                    'ends_at' => $now->copy()->addMinutes($minutes),
                    'last_seen_at' => $now,
                    'status' => ExamAttempt::STATUS_IN_PROGRESS,
                    'ip_address' => $ip,
                    'user_agent' => Str::limit((string) $userAgent, 250, ''),
                    'question_order' => $questions->pluck('id')->all(),
                    'unanswered_count' => $questions->count(),
                ]);
            } catch (UniqueConstraintViolationException) {
                // dua request "mulai" hampir bersamaan: pakai sesi yang sudah dibuat request pertama
                throw ValidationException::withMessages(['exam' => 'Sesi ujian sedang dibuka. Silakan ulangi.']);
            }

            $rows = [];
            $position = 1;
            foreach ($questions as $q) {
                $keys = collect($q->options ?? [])->pluck('key')->all();
                $optionOrder = ($exam->shuffle_options && $q->shuffle_options && $q->isMultipleChoice())
                    ? collect($keys)->shuffle()->values()->all()
                    : $keys;
                $rows[] = [
                    'exam_attempt_id' => $attempt->id,
                    'question_id' => $q->id,
                    'position' => $position++,
                    'option_order' => json_encode($optionOrder),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            AttemptAnswer::insert($rows);

            ExamLog::record('start', $attempt, $exam, ['ip' => $ip, 'minutes' => $minutes], 'student', $student->id);

            return $attempt;
        });
    }

    /**
     * Pilih soal dari bank sesuai jumlah PG/esai pada jadwal, diacak bila diminta.
     */
    protected function pickQuestions(Exam $exam)
    {
        $bank = $exam->questionBank;
        $mc = $bank->questions()->where('type', Question::TYPE_MC)->get();
        $essay = $bank->questions()->where('type', Question::TYPE_ESSAY)->get();

        if ($exam->shuffle_questions) {
            $mc = $mc->shuffle();
            $essay = $essay->shuffle();
        }
        if ($exam->mc_count > 0) {
            $mc = $mc->take($exam->mc_count);
        }
        if ($exam->essay_count > 0) {
            $essay = $essay->take($exam->essay_count);
        } elseif ($exam->essay_count === 0 && $exam->mc_count > 0) {
            $essay = collect();
        }

        return $mc->concat($essay)->values();
    }

    /**
     * Simpan jawaban satu soal. Mengembalikan ringkasan untuk UI.
     */
    public function answer(ExamAttempt $attempt, int $questionId, ?string $answer, ?string $essay, ?bool $doubtful): array
    {
        $this->guardInProgress($attempt);

        $row = AttemptAnswer::where('exam_attempt_id', $attempt->id)
            ->where('question_id', $questionId)
            ->with('question')
            ->firstOrFail();

        $q = $row->question;
        $changes = [];

        if ($q->isMultipleChoice() && $answer !== null) {
            $valid = collect($q->options ?? [])->pluck('key')->all();
            if (!in_array($answer, $valid, true)) {
                throw ValidationException::withMessages(['answer' => 'Pilihan tidak valid.']);
            }
            $changes['answer'] = $answer;
            $changes['is_correct'] = $q->answer_key !== null ? ($answer === $q->answer_key) : null;
            $changes['answered_at'] = now();
        }
        if ($q->isEssay() && $essay !== null) {
            $changes['essay_answer'] = trim($essay) === '' ? null : $essay;
            $changes['answered_at'] = now();
        }
        if ($doubtful !== null) {
            $changes['is_doubtful'] = $doubtful;
        }

        if ($changes) {
            $row->fill($changes)->save();
        }
        $attempt->forceFill(['last_seen_at' => now()])->save();

        return [
            'question_id' => $q->id,
            'answer' => $row->answer,
            'has_essay' => $row->essay_answer !== null,
            'is_doubtful' => $row->is_doubtful,
        ];
    }

    public function touch(ExamAttempt $attempt): void
    {
        if ($attempt->isInProgress()) {
            $attempt->forceFill(['last_seen_at' => now()])->save();
        }
    }

    /**
     * Tutup sesi dan hitung nilai. Aman dipanggil berulang.
     */
    public function finish(ExamAttempt $attempt, string $status = ExamAttempt::STATUS_FINISHED, ?string $actorType = null, ?int $actorId = null): ExamAttempt
    {
        return DB::transaction(function () use ($attempt, $status, $actorType, $actorId) {
            $attempt = ExamAttempt::whereKey($attempt->id)->lockForUpdate()->first();
            if ($attempt->isFinished()) {
                return $attempt;
            }

            $this->grade($attempt);
            $attempt->forceFill([
                'status' => $status,
                'finished_at' => now(),
            ])->save();

            ExamLog::record('finish', $attempt, null, ['status' => $status], $actorType ?? 'student', $actorId ?? $attempt->student_id);

            return $attempt;
        });
    }

    /**
     * Hitung nilai PG dan esai, simpan ke attempt. Dipanggil ulang setelah koreksi esai.
     */
    public function grade(ExamAttempt $attempt): ExamAttempt
    {
        $exam = $attempt->exam;
        $answers = $attempt->answers()->with('question')->get();

        $mc = $answers->filter(fn ($a) => $a->question->isMultipleChoice());
        $essay = $answers->filter(fn ($a) => $a->question->isEssay());

        $correct = $mc->where('is_correct', true)->count();
        $answeredMc = $mc->whereNotNull('answer')->count();
        $wrong = $answeredMc - $correct;
        $unanswered = $mc->count() - $answeredMc + $essay->whereNull('essay_answer')->count();

        $scoreMc = $mc->count() > 0 ? round($correct / $mc->count() * 100, 2) : null;

        $scoreEssay = null;
        if ($essay->count() > 0) {
            $graded = $essay->whereNotNull('essay_score');
            $scoreEssay = $graded->count() > 0
                ? round($graded->sum('essay_score') / $essay->count(), 2)
                : null;
        }

        $total = null;
        if ($scoreMc !== null || $scoreEssay !== null) {
            $wMc = $exam->mc_weight_percent / 100;
            $wEs = $exam->essay_weight_percent / 100;
            if ($mc->count() === 0) {
                $total = $scoreEssay;
            } elseif ($essay->count() === 0) {
                $total = $scoreMc;
            } else {
                $total = round(($scoreMc ?? 0) * $wMc + ($scoreEssay ?? 0) * $wEs, 2);
            }
        }

        $attempt->forceFill([
            'correct_count' => $correct,
            'wrong_count' => max(0, $wrong),
            'unanswered_count' => max(0, $unanswered),
            'score_mc' => $scoreMc,
            'score_essay' => $scoreEssay,
            'total_score' => $total,
        ])->save();

        return $attempt;
    }

    /**
     * Tutup otomatis sesi yang sudah lewat waktu (dipanggil saat polling / akses).
     */
    public function finishIfExpired(ExamAttempt $attempt): ExamAttempt
    {
        if ($attempt->isExpired()) {
            return $this->finish($attempt, ExamAttempt::STATUS_FINISHED, 'system');
        }

        return $attempt;
    }

    public function addTime(ExamAttempt $attempt, int $minutes, int $userId): ExamAttempt
    {
        $attempt->forceFill([
            'ends_at' => $attempt->ends_at->addMinutes($minutes),
            'extra_minutes' => $attempt->extra_minutes + $minutes,
        ])->save();
        ExamLog::record('add_time', $attempt, null, ['minutes' => $minutes], 'user', $userId);

        return $attempt;
    }

    /**
     * Reset sesi peserta: hapus jawaban supaya bisa login dan mulai lagi.
     */
    public function reset(ExamAttempt $attempt, int $userId): void
    {
        DB::transaction(function () use ($attempt, $userId) {
            ExamLog::record('reset', $attempt, null, [], 'user', $userId);
            $attempt->answers()->delete();
            $attempt->delete();
        });
    }

    /**
     * Payload halaman ujian untuk peserta (tanpa kunci).
     */
    public function payload(ExamAttempt $attempt): array
    {
        $attempt->loadMissing(['exam.questionBank.subject', 'answers.question']);

        $questions = $attempt->answers->map(function (AttemptAnswer $a) {
            $q = $a->question->toStudentPayload($a->option_order);

            return $q + [
                'position' => $a->position,
                'answer' => $a->answer,
                'essay_answer' => $a->essay_answer,
                'is_doubtful' => $a->is_doubtful,
            ];
        })->values();

        return [
            'attempt' => [
                'id' => $attempt->id,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at->toIso8601String(),
                'ends_at' => $attempt->ends_at->toIso8601String(),
                'remaining_seconds' => $attempt->remainingSeconds(),
                'server_time' => now()->toIso8601String(),
            ],
            'exam' => [
                'id' => $attempt->exam->id,
                'name' => $attempt->exam->name,
                'subject' => $attempt->exam->questionBank->subject->name,
                'duration_minutes' => $attempt->exam->duration_minutes,
            ],
            'questions' => $questions,
        ];
    }

    protected function guardInProgress(ExamAttempt $attempt): void
    {
        $this->finishIfExpired($attempt);
        if (!$attempt->isInProgress()) {
            throw ValidationException::withMessages(['exam' => 'Sesi ujian sudah berakhir.']);
        }
    }
}
