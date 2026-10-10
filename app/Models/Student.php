<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Student extends Authenticatable
{
    use HasFactory;

    public const SCHOOL_TYPES = ['negeri', 'swasta', 'internasional'];

    protected $fillable = [
        'exam_number', 'nisn', 'name', 'gender', 'password',
        'grade_id', 'grade_level_id', 'major_id', 'curriculum_id', 'academic_year_id',
        'class_name', 'session_no', 'room', 'school_origin', 'school_type', 'elective_subject_ids',
        'photo', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'session_no' => 'integer',
            'elective_subject_ids' => 'array',
        ];
    }

    /** Rombel saat ini. */
    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    /** Tingkat saat ini (kanonik 1–12). */
    public function gradeLevel(): BelongsTo
    {
        return $this->belongsTo(GradeLevel::class);
    }

    /** Peminatan saat ini (IPA/IPS/...), opsional. */
    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /** Riwayat keanggotaan per tahun ajaran. */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class)->orderByDesc('academic_year_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    /**
     * Salin kondisi saat ini ke riwayat tahun ajaran (dibuat atau diperbarui).
     */
    public function syncEnrollment(?int $academicYearId = null): ?Enrollment
    {
        $yearId = $academicYearId ?? $this->academic_year_id ?? AcademicYear::active()?->id;
        if (!$yearId) {
            return null;
        }

        return Enrollment::updateOrCreate(
            ['student_id' => $this->id, 'academic_year_id' => $yearId],
            [
                'grade_level_id' => $this->grade_level_id,
                'grade_id' => $this->grade_id,
                'major_id' => $this->major_id,
                'curriculum_id' => $this->curriculum_id,
                'school_origin' => $this->school_origin,
                'school_type' => $this->school_type,
                'elective_subject_ids' => $this->elective_subject_ids,
            ]
        );
    }
}
