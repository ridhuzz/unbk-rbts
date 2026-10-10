<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mata uji: mata pelajaran sekolah (kind = school) atau subtes format ujian (kind = subtest).
 */
class Subject extends Model
{
    public const KIND_SCHOOL = 'school';
    public const KIND_SUBTEST = 'subtest';

    protected $fillable = ['code', 'name', 'kind', 'exam_format_id', 'min_grade', 'max_grade', 'is_elective', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_elective' => 'boolean',
            'min_grade' => 'integer',
            'max_grade' => 'integer',
        ];
    }

    public function examFormat(): BelongsTo
    {
        return $this->belongsTo(ExamFormat::class);
    }

    public function questionBanks(): HasMany
    {
        return $this->hasMany(QuestionBank::class);
    }

    /** Mata uji yang berlaku untuk tingkat tertentu (rentang kosong = semua tingkat). */
    public function scopeForGradeNumber(Builder $q, ?int $number): Builder
    {
        if (!$number) {
            return $q;
        }

        return $q->where(fn ($w) => $w->whereNull('min_grade')->orWhere('min_grade', '<=', $number))
            ->where(fn ($w) => $w->whereNull('max_grade')->orWhere('max_grade', '>=', $number));
    }
}
