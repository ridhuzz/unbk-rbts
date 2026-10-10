<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\Student;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StudentController extends Controller
{
    public function index(Request $request): Response
    {
        $q = Student::query()->with(['grade:id,code,name', 'major:id,code', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code', 'curriculum:id,name,year_label']);

        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('name', 'like', "%$s%")
                ->orWhere('exam_number', 'like', "%$s%")
                ->orWhere('class_name', 'like', "%$s%")
                ->orWhere('school_origin', 'like', "%$s%"));
        }
        if ($gl = $request->integer('grade_level_id')) {
            $q->where('grade_level_id', $gl);
        }
        if ($g = $request->integer('grade_id')) {
            $q->where('grade_id', $g);
        }
        if ($m = $request->integer('major_id')) {
            $q->where('major_id', $m);
        }

        return Inertia::render('admin/students/index', [
            'students' => $q->orderBy('grade_level_id')->orderBy('grade_id')->orderBy('name')->paginate(25)->withQueryString()
                ->through(fn (Student $st) => $this->row($st)),
            'filters' => $request->only(['q', 'grade_level_id', 'grade_id', 'major_id']),
        ] + MasterController::academicOptions());
    }

    public function show(Student $student): Response
    {
        $student->load(['enrollments.academicYear', 'enrollments.gradeLevel.level', 'enrollments.grade', 'enrollments.major', 'enrollments.curriculum', 'attempts.exam.questionBank.subject']);

        return Inertia::render('admin/students/show', [
            'student' => $this->row($student),
            'enrollments' => $student->enrollments->map(fn ($e) => [
                'id' => $e->id,
                'academic_year' => $e->academicYear?->code,
                'tingkat' => $e->gradeLevel ? "{$e->gradeLevel->level->code} {$e->gradeLevel->number}" : null,
                'grade' => $e->grade?->code,
                'major' => $e->major?->code,
                'curriculum' => $e->curriculum?->label(),
                'school_origin' => $e->school_origin,
                'school_type' => $e->school_type,
            ])->values(),
            'attempts' => $student->attempts->sortByDesc('started_at')->map(fn ($a) => [
                'id' => $a->id,
                'exam_id' => $a->exam_id,
                'exam' => $a->exam->name,
                'subject' => $a->exam->questionBank->subject->name,
                'exam_date' => $a->exam->exam_date->format('Y-m-d'),
                'status' => $a->status,
                'total_score' => $a->total_score,
                'published' => $a->exam->resultsPublished(),
            ])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['password'] = ($data['password'] ?? null) ?: $data['exam_number'];
        $student = Student::create($data);
        $student->syncEnrollment();

        return back()->with('success', 'Peserta ditambahkan.');
    }

    public function update(Request $request, Student $student): RedirectResponse
    {
        $data = $this->validated($request, $student);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        $student->update($data);
        $student->syncEnrollment();

        return back()->with('success', 'Peserta diperbarui.');
    }

    public function destroy(Student $student): RedirectResponse
    {
        $student->delete();

        return back()->with('success', 'Peserta dihapus.');
    }

    /**
     * Reset password ke nomor peserta.
     */
    public function resetPassword(Student $student): RedirectResponse
    {
        $student->update(['password' => $student->exam_number]);

        return back()->with('success', "Password {$student->name} direset ke nomor peserta.");
    }

    /**
     * Naik tingkat ke tahun ajaran aktif: tingkat +1, rombel dikosongkan, riwayat tahun lama tetap.
     * Bisa untuk satu peserta atau seluruh peserta satu rombel.
     */
    public function promote(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'student_ids' => ['nullable', 'array'],
            'student_ids.*' => ['integer', 'exists:students,id'],
            'grade_id' => ['nullable', 'integer', 'exists:grades,id'],
            'target_grade_id' => ['nullable', 'integer', 'exists:grades,id'],
        ]);
        $year = AcademicYear::active();
        if (!$year) {
            return back()->with('error', 'Belum ada tahun ajaran aktif.');
        }
        $targets = Student::query()
            ->when(!empty($data['student_ids']), fn ($q) => $q->whereIn('id', $data['student_ids']))
            ->when(!empty($data['grade_id']), fn ($q) => $q->where('grade_id', $data['grade_id']))
            ->get();
        if ($targets->isEmpty()) {
            return back()->with('error', 'Tidak ada peserta yang dipilih.');
        }
        $targetGrade = !empty($data['target_grade_id']) ? Grade::find($data['target_grade_id']) : null;
        $byNumber = GradeLevel::pluck('id', 'number')->all();

        $promoted = 0;
        $graduated = 0;
        DB::transaction(function () use ($targets, $year, $targetGrade, $byNumber, &$promoted, &$graduated) {
            foreach ($targets as $s) {
                if ($s->enrollments()->where('academic_year_id', $year->id)->exists()) {
                    continue; // sudah tercatat di tahun aktif
                }
                $current = $s->grade_level_id ? GradeLevel::find($s->grade_level_id)?->number : null;
                $next = $current ? $current + 1 : null;
                if ($next && !isset($byNumber[$next])) {
                    $s->update(['is_active' => false]); // lulus dari tingkat 12
                    $graduated++;
                    continue;
                }
                $s->update([
                    'grade_level_id' => $next ? $byNumber[$next] : $s->grade_level_id,
                    'grade_id' => $targetGrade?->id,
                    'academic_year_id' => $year->id,
                    'class_name' => $targetGrade?->name,
                ]);
                $s->syncEnrollment($year->id);
                $promoted++;
            }
        });

        return back()->with('success', "{$promoted} peserta naik tingkat ke {$year->code}" . ($graduated ? ", {$graduated} ditandai lulus/nonaktif" : '') . '.');
    }

    private function row(Student $st): array
    {
        return [
            'id' => $st->id,
            'exam_number' => $st->exam_number,
            'nisn' => $st->nisn,
            'name' => $st->name,
            'gender' => $st->gender,
            'level_id' => $st->gradeLevel?->level_id,
            'grade_level_id' => $st->grade_level_id,
            'tingkat' => $st->gradeLevel ? "{$st->gradeLevel->level->code} {$st->gradeLevel->number}" : null,
            'grade' => $st->grade?->code,
            'grade_id' => $st->grade_id,
            'major' => $st->major?->code,
            'major_id' => $st->major_id,
            'curriculum_id' => $st->curriculum_id,
            'curriculum' => $st->curriculum?->label(),
            'academic_year_id' => $st->academic_year_id,
            'class_name' => $st->class_name,
            'session_no' => $st->session_no,
            'room' => $st->room,
            'school_origin' => $st->school_origin,
            'school_type' => $st->school_type,
            'elective_subject_ids' => $st->elective_subject_ids ?? [],
            'is_active' => $st->is_active,
        ];
    }

    private function validated(Request $request, ?Student $student = null): array
    {
        $data = $request->validate([
            'exam_number' => ['required', 'string', 'max:30', Rule::unique('students', 'exam_number')->ignore($student?->id)],
            'nisn' => ['nullable', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:150'],
            'gender' => ['nullable', Rule::in(['L', 'P'])],
            'password' => ['nullable', 'string', 'min:4', 'max:100'],
            'grade_level_id' => ['required', 'integer', 'exists:grade_levels,id'],
            'grade_id' => ['nullable', 'integer', 'exists:grades,id'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
            'curriculum_id' => ['nullable', 'integer', 'exists:curricula,id'],
            'academic_year_id' => ['nullable', 'integer', 'exists:academic_years,id'],
            'class_name' => ['nullable', 'string', 'max:60'],
            'session_no' => ['nullable', 'integer', 'min:1', 'max:20'],
            'room' => ['nullable', 'string', 'max:30'],
            'school_origin' => ['nullable', 'string', 'max:150'],
            'school_type' => ['nullable', Rule::in(Student::SCHOOL_TYPES)],
            'elective_subject_ids' => ['nullable', 'array', 'max:10'],
            'elective_subject_ids.*' => ['integer', 'exists:subjects,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        // rombel harus satu tingkat dengan peserta
        if (!empty($data['grade_id'])) {
            $grade = Grade::find($data['grade_id']);
            if ($grade && $grade->grade_level_id && (int) $grade->grade_level_id !== (int) $data['grade_level_id']) {
                throw \Illuminate\Validation\ValidationException::withMessages(['grade_id' => 'Rombel yang dipilih bukan untuk tingkat ini.']);
            }
            $data['class_name'] = ($data['class_name'] ?? null) ?: $grade?->name;
        }
        $data['exam_number'] = trim($data['exam_number']);
        $data['session_no'] = $data['session_no'] ?? 1;
        $data['is_active'] = $data['is_active'] ?? true;
        $data['academic_year_id'] = $data['academic_year_id'] ?? AcademicYear::active()?->id;
        $data['elective_subject_ids'] = array_values(array_unique($data['elective_subject_ids'] ?? []));

        return $data;
    }
}
