<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'exam_id', 'exam_attempt_id', 'actor_type', 'actor_id', 'event', 'meta', 'ip_address', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public static function record(
        string $event,
        ?ExamAttempt $attempt = null,
        ?Exam $exam = null,
        array $meta = [],
        ?string $actorType = null,
        ?int $actorId = null,
    ): self {
        return static::create([
            'exam_id' => $exam?->id ?? $attempt?->exam_id,
            'exam_attempt_id' => $attempt?->id,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'event' => $event,
            'meta' => $meta ?: null,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
