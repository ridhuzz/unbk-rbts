<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Rombel (kelompok belajar) per tahun ajaran, menempel pada satu tingkat. */
class Grade extends Model
{
    protected $fillable = ['code', 'name', 'level', 'grade_level_id', 'academic_year_id', 'major_id', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
