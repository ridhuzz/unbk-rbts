<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_FINISHED = 'finished';
    public const STATUS_FORCE_FINISHED = 'force_finished';

    protected $fillable = [
        'exam_id', 'student_id', 'session_token', 'started_at', 'ends_at', 'finished_at', 'last_seen_at',
        'status', 'ip_address', 'user_agent', 'extra_minutes', 'question_order',
        'correct_count', 'wrong_count', 'unanswered_count', 'score_mc', 'score_essay', 'total_score',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ends_at' => 'datetime',
            'finished_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'question_order' => 'array',
            'extra_minutes' => 'integer',
            'score_mc' => 'float',
            'score_essay' => 'float',
            'total_score' => 'float',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AttemptAnswer::class)->orderBy('position');
    }

    public function isInProgress(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    public function isFinished(): bool
    {
        return in_array($this->status, [self::STATUS_FINISHED, self::STATUS_FORCE_FINISHED], true);
    }

    public function remainingSeconds(): int
    {
        if (!$this->isInProgress()) {
            return 0;
        }

        return max(0, now()->diffInSeconds($this->ends_at, false));
    }

    public function isExpired(): bool
    {
        return $this->isInProgress() && now()->greaterThanOrEqualTo($this->ends_at);
    }
}
