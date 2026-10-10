<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Keanggotaan siswa per tahun ajaran: riwayat tingkat, rombel, peminatan, kurikulum, sekolah asal. */
class Enrollment extends Model
{
    protected $fillable = [
        'student_id', 'academic_year_id', 'grade_level_id', 'grade_id', 'major_id', 'curriculum_id',
        'school_origin', 'school_type', 'elective_subject_ids', 'notes',
    ];

    protected function casts(): array
    {
        return ['elective_subject_ids' => 'array'];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }
}
