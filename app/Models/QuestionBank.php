<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Bank soal: mata uji + tingkat (+ peminatan, kurikulum/format acuan). Tidak lagi menyasar rombel. */
class QuestionBank extends Model
{
    protected $fillable = [
        'code', 'name', 'subject_id', 'grade_id', 'grade_level_id', 'major_id', 'curriculum_id', 'exam_format_id',
        'academic_year_id', 'option_count', 'description', 'created_by', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'option_count' => 'integer',
        ];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }

    public function examFormat(): BelongsTo
    {
        return $this->belongsTo(ExamFormat::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('number');
    }

    public function exams(): HasMany
    {
        return $this->hasMany(Exam::class);
    }
}
