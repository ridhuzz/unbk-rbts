<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttemptAnswer extends Model
{
    protected $fillable = [
        'exam_attempt_id', 'question_id', 'position', 'option_order', 'answer', 'essay_answer',
        'is_doubtful', 'is_correct', 'essay_score', 'graded_by', 'answered_at',
    ];

    protected function casts(): array
    {
        return [
            'option_order' => 'array',
            'is_doubtful' => 'boolean',
            'is_correct' => 'boolean',
            'essay_score' => 'float',
            'answered_at' => 'datetime',
            'position' => 'integer',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function grader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'graded_by');
    }
}
