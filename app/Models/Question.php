<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends Model
{
    public const TYPE_MC = 'multiple_choice';
    public const TYPE_ESSAY = 'essay';

    protected $fillable = [
        'question_bank_id', 'number', 'type', 'body', 'image', 'audio', 'video',
        'options', 'answer_key', 'shuffle_options', 'weight',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'shuffle_options' => 'boolean',
            'weight' => 'decimal:2',
            'number' => 'integer',
        ];
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(QuestionBank::class, 'question_bank_id');
    }

    public function isMultipleChoice(): bool
    {
        return $this->type === self::TYPE_MC;
    }

    public function isEssay(): bool
    {
        return $this->type === self::TYPE_ESSAY;
    }

    /**
     * Payload yang aman dikirim ke peserta: tanpa kunci jawaban.
     */
    public function toStudentPayload(?array $optionOrder = null): array
    {
        $options = collect($this->options ?? []);
        if ($optionOrder) {
            $options = collect($optionOrder)
                ->map(fn ($key) => $options->firstWhere('key', $key))
                ->filter()
                ->values();
        }

        return [
            'id' => $this->id,
            'type' => $this->type,
            'body' => $this->body,
            'image' => $this->image ? asset('storage/' . $this->image) : null,
            'audio' => $this->audio ? asset('storage/' . $this->audio) : null,
            'video' => $this->video ? asset('storage/' . $this->video) : null,
            'options' => $options->map(fn ($o) => [
                'key' => $o['key'],
                'body' => $o['body'] ?? '',
                'image' => !empty($o['image']) ? asset('storage/' . $o['image']) : null,
            ])->values()->all(),
        ];
    }
}
