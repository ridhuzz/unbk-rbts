<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Exam extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_FINISHED = 'finished';

    protected $fillable = [
        'code', 'name', 'question_bank_id', 'academic_year_id', 'grade_id', 'grade_level_id', 'major_id', 'exam_format_id', 'session_no',
        'exam_date', 'start_time', 'late_limit_time', 'duration_minutes', 'late_policy',
        'token', 'show_token', 'shuffle_questions', 'shuffle_options', 'mc_count', 'essay_count',
        'mc_weight_percent', 'essay_weight_percent', 'status', 'proctor_name', 'supervisor_name',
        'notes', 'instructions', 'results_published_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'exam_date' => 'date:Y-m-d',
            'results_published_at' => 'datetime',
            'show_token' => 'boolean',
            'shuffle_questions' => 'boolean',
            'shuffle_options' => 'boolean',
            'duration_minutes' => 'integer',
            'mc_count' => 'integer',
            'essay_count' => 'integer',
            'mc_weight_percent' => 'integer',
            'essay_weight_percent' => 'integer',
            'session_no' => 'integer',
        ];
    }

    public static function generateToken(): string
    {
        return strtoupper(Str::random(5));
    }

    public function questionBank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function examFormat(): BelongsTo
    {
        return $this->belongsTo(ExamFormat::class);
    }

    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ExamLog::class);
    }

    public function scopeActive(Builder $q): Builder
    {
        return $q->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Ujian aktif hari ini yang berlaku untuk peserta ini.
     * Target berantai: tingkat (wajib cocok bila diisi) -> rombel -> peminatan -> sesi. Kosong = semua.
     */
    public function scopeForStudent(Builder $q, Student $student): Builder
    {
        return $q->active()
            ->whereDate('exam_date', today())
            ->targetsStudent($student)
            ->orderBy('start_time');
    }

    /** Syarat kelayakan peserta untuk jadwal ini, dipakai halaman peserta dan monitor. */
    public function scopeTargetsStudent(Builder $q, Student $student): Builder
    {
        return $q
            ->where(fn ($w) => $w->whereNull('grade_level_id')->orWhere('grade_level_id', $student->grade_level_id))
            ->where(fn ($w) => $w->whereNull('grade_id')->orWhere('grade_id', $student->grade_id))
            ->where(fn ($w) => $w->whereNull('major_id')->orWhere('major_id', $student->major_id))
            ->where(fn ($w) => $w->whereNull('session_no')->orWhere('session_no', $student->session_no));
    }

    /** Query peserta yang menjadi target jadwal ini (kebalikan dari targetsStudent). */
    public function eligibleStudents(): Builder
    {
        return Student::query()->where('is_active', true)
            ->when($this->grade_level_id, fn ($q) => $q->where('grade_level_id', $this->grade_level_id))
            ->when($this->grade_id, fn ($q) => $q->where('grade_id', $this->grade_id))
            ->when($this->major_id, fn ($q) => $q->where('major_id', $this->major_id))
            ->when($this->session_no, fn ($q) => $q->where('session_no', $this->session_no));
    }

    public function startsAt(): Carbon
    {
        return Carbon::parse($this->exam_date->format('Y-m-d') . ' ' . $this->start_time);
    }

    public function lateLimitAt(): Carbon
    {
        return Carbon::parse($this->exam_date->format('Y-m-d') . ' ' . $this->late_limit_time);
    }

    public function isOpenNow(): bool
    {
        $now = now();

        return $this->status === self::STATUS_ACTIVE
            && $now->greaterThanOrEqualTo($this->startsAt())
            && $now->lessThanOrEqualTo($this->lateLimitAt());
    }

    public function windowState(): string
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return 'inactive';
        }
        $now = now();
        if ($now->lessThan($this->startsAt())) {
            return 'not_started';
        }
        if ($now->greaterThan($this->lateLimitAt())) {
            return 'closed';
        }

        return 'open';
    }

    public function totalQuestions(): int
    {
        return $this->mc_count + $this->essay_count;
    }

    public function resultsPublished(): bool
    {
        return $this->results_published_at !== null;
    }

    /**
     * Daftar masalah yang membuat ujian belum layak diaktifkan. Kosong = siap.
     */
    public function readinessProblems(): array
    {
        $problems = [];
        $bank = $this->questionBank;

        if (!$bank) {
            return ['Bank soal tidak ditemukan.'];
        }
        if (!$bank->is_active) {
            $problems[] = "Bank soal {$bank->code} berstatus nonaktif.";
        }

        $mc = $bank->questions()->where('type', Question::TYPE_MC)->get(['id', 'number', 'answer_key', 'options']);
        $essayTotal = $bank->questions()->where('type', Question::TYPE_ESSAY)->count();

        if ($this->mc_count + $this->essay_count === 0) {
            $problems[] = 'Jumlah soal masih nol.';
        }
        if ($this->mc_count > $mc->count()) {
            $problems[] = "Jadwal meminta {$this->mc_count} soal PG, bank hanya punya {$mc->count()}.";
        }
        if ($this->essay_count > $essayTotal) {
            $problems[] = "Jadwal meminta {$this->essay_count} soal esai, bank hanya punya {$essayTotal}.";
        }

        $noKey = $mc->filter(fn ($q) => $q->answer_key === null || !collect($q->options ?? [])->pluck('key')->contains($q->answer_key));
        if ($this->mc_count > 0 && $noKey->isNotEmpty()) {
            $problems[] = 'Soal PG tanpa kunci jawaban yang valid: nomor ' . $noKey->pluck('number')->sort()->take(10)->implode(', ') . ($noKey->count() > 10 ? ', …' : '') . '.';
        }
        if ($this->duration_minutes < 1) {
            $problems[] = 'Durasi ujian belum diisi.';
        }
        if ($this->lateLimitAt()->lessThanOrEqualTo($this->startsAt())) {
            $problems[] = 'Batas masuk harus setelah jam mulai.';
        }
        if ($this->mc_weight_percent + $this->essay_weight_percent !== 100) {
            $problems[] = 'Bobot PG dan esai harus berjumlah 100%.';
        }

        return $problems;
    }

    /**
     * Aturan perpindahan status. Mengembalikan pesan penolakan, atau null bila boleh.
     */
    public function transitionBlocker(string $to): ?string
    {
        $from = $this->status;
        if ($from === $to) {
            return null;
        }
        $hasAttempts = $this->attempts()->exists();

        return match ([$from, $to]) {
            [self::STATUS_DRAFT, self::STATUS_ACTIVE], [self::STATUS_FINISHED, self::STATUS_ACTIVE] => $this->readinessProblems()[0] ?? null,
            [self::STATUS_ACTIVE, self::STATUS_FINISHED] => null,
            [self::STATUS_DRAFT, self::STATUS_FINISHED] => 'Ujian draft tidak bisa langsung ditutup. Aktifkan dulu atau hapus jadwalnya.',
            [self::STATUS_ACTIVE, self::STATUS_DRAFT], [self::STATUS_FINISHED, self::STATUS_DRAFT] => $hasAttempts
                ? 'Sudah ada peserta yang mengerjakan; jadwal tidak bisa dikembalikan ke draft.'
                : null,
            default => 'Perpindahan status tidak dikenal.',
        };
    }
}
