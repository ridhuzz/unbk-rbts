<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Curriculum;
use App\Models\ExamFormat;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\Level;
use App\Models\Major;
use App\Models\Subject;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Data master akademik berantai:
 *   jenjang -> tingkat (referensi tetap) -> rombel (per tahun ajaran)
 *   peminatan, mata uji (mapel sekolah / subtes format), kurikulum, format ujian, tahun ajaran.
 */
class MasterController extends Controller
{
    private const TYPES = [
        'academic-years' => AcademicYear::class,
        'majors' => Major::class,
        'grades' => Grade::class,
        'subjects' => Subject::class,
        'curricula' => Curriculum::class,
        'exam-formats' => ExamFormat::class,
    ];

    public function index(): Response
    {
        return Inertia::render('admin/masters/index', [
            'levels' => Level::with('gradeLevels')->orderBy('sort')->get()
                ->map(fn (Level $l) => [
                    'id' => $l->id, 'code' => $l->code, 'name' => $l->name,
                    'grade_levels' => $l->gradeLevels->map(fn ($g) => ['id' => $g->id, 'number' => $g->number, 'name' => $g->name, 'intl_label' => $g->intl_label])->values(),
                ]),
            'academic_years' => AcademicYear::orderByDesc('is_active')->orderByDesc('code')->get(),
            'majors' => Major::orderBy('code')->get(),
            'grades' => Grade::with(['major:id,code', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code', 'academicYear:id,code'])
                ->withCount('students')->orderBy('grade_level_id')->orderBy('code')->get()
                ->map(fn (Grade $g) => [
                    'id' => $g->id, 'code' => $g->code, 'name' => $g->name, 'is_active' => $g->is_active,
                    'grade_level_id' => $g->grade_level_id, 'level_id' => $g->gradeLevel?->level_id,
                    'tingkat' => $g->gradeLevel ? "{$g->gradeLevel->level->code} {$g->gradeLevel->number}" : null,
                    'academic_year_id' => $g->academic_year_id, 'academic_year' => $g->academicYear?->code,
                    'major_id' => $g->major_id, 'major' => $g->major?->code, 'students_count' => $g->students_count,
                ]),
            'subjects' => Subject::with('examFormat:id,code,name')->orderBy('kind')->orderBy('code')->get()
                ->map(fn (Subject $s) => [
                    'id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'kind' => $s->kind, 'is_active' => $s->is_active,
                    'exam_format_id' => $s->exam_format_id, 'exam_format' => $s->examFormat?->name,
                    'min_grade' => $s->min_grade, 'max_grade' => $s->max_grade, 'is_elective' => $s->is_elective,
                ]),
            'curricula' => Curriculum::orderBy('name')->get(),
            'exam_formats' => ExamFormat::withCount('subtests')->orderByDesc('is_active')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request, string $type): RedirectResponse
    {
        $model = $this->model($type);
        $row = $model::create($this->validated($request, $type));
        $this->afterSave($type, $row);

        return back()->with('success', 'Data ditambahkan.');
    }

    public function update(Request $request, string $type, int $id): RedirectResponse
    {
        $model = $this->model($type);
        $row = $model::findOrFail($id);
        $row->update($this->validated($request, $type, $id));
        $this->afterSave($type, $row);

        return back()->with('success', 'Data diperbarui.');
    }

    public function destroy(string $type, int $id): RedirectResponse
    {
        $model = $this->model($type);
        try {
            $model::findOrFail($id)->delete();
        } catch (\Illuminate\Database\QueryException) {
            return back()->with('error', 'Data masih dipakai dan tidak bisa dihapus.');
        }

        return back()->with('success', 'Data dihapus.');
    }

    private function model(string $type): string
    {
        abort_unless(isset(self::TYPES[$type]), 404);

        return self::TYPES[$type];
    }

    private function validated(Request $request, string $type, ?int $id = null): array
    {
        $table = (new (self::TYPES[$type]))->getTable();
        $code = ['required', 'string', 'max:30', Rule::unique($table, 'code')->ignore($id)];
        $active = ['nullable', 'boolean'];

        $rules = match ($type) {
            'academic-years' => ['code' => $code, 'name' => ['required', 'string', 'max:100'], 'is_active' => $active],
            'majors' => ['code' => $code, 'name' => ['required', 'string', 'max:100'], 'is_active' => $active],
            'grades' => [
                'code' => $code,
                'name' => ['required', 'string', 'max:100'],
                'grade_level_id' => ['required', 'integer', 'exists:grade_levels,id'],
                'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
                'major_id' => ['nullable', 'integer', 'exists:majors,id'],
                'is_active' => $active,
            ],
            'subjects' => [
                'code' => $code,
                'name' => ['required', 'string', 'max:100'],
                'kind' => ['required', Rule::in([Subject::KIND_SCHOOL, Subject::KIND_SUBTEST])],
                'exam_format_id' => ['nullable', 'integer', 'exists:exam_formats,id', Rule::requiredIf(fn () => $request->input('kind') === Subject::KIND_SUBTEST)],
                'min_grade' => ['nullable', 'integer', 'min:1', 'max:12'],
                'max_grade' => ['nullable', 'integer', 'min:1', 'max:12', 'gte:min_grade'],
                'is_elective' => ['nullable', 'boolean'],
                'is_active' => $active,
            ],
            'curricula' => [
                'name' => ['required', 'string', 'max:100'],
                'year_label' => ['nullable', 'string', 'max:50'],
                'is_active' => $active,
            ],
            'exam-formats' => [
                'code' => $code,
                'name' => ['required', 'string', 'max:100'],
                'year_label' => ['nullable', 'string', 'max:50'],
                'is_active' => $active,
            ],
        };

        $data = $request->validate($rules);
        if (isset($data['code'])) {
            $data['code'] = strtoupper(trim($data['code']));
        }
        $data['is_active'] = $data['is_active'] ?? true;
        if ($type === 'subjects') {
            $data['is_elective'] = $data['is_elective'] ?? false;
            if ($data['kind'] === Subject::KIND_SCHOOL) {
                $data['exam_format_id'] = null;
            }
        }

        return $data;
    }

    private function afterSave(string $type, Model $row): void
    {
        if ($type === 'academic-years' && $row->is_active) {
            AcademicYear::whereKeyNot($row->id)->update(['is_active' => false]);
        }
    }

    /**
     * Daftar referensi untuk form berantai di halaman lain (peserta, bank soal, jadwal).
     */
    public static function academicOptions(): array
    {
        return [
            'levels' => Level::with('gradeLevels')->orderBy('sort')->get()
                ->map(fn (Level $l) => [
                    'id' => $l->id, 'code' => $l->code, 'name' => $l->name,
                    'grade_levels' => $l->gradeLevels->map(fn (GradeLevel $g) => ['id' => $g->id, 'number' => $g->number, 'name' => $g->name])->values(),
                ]),
            'grades' => Grade::where('is_active', true)->with('gradeLevel:id,level_id,number')->orderBy('code')->get()
                ->map(fn (Grade $g) => ['id' => $g->id, 'code' => $g->code, 'name' => $g->name, 'grade_level_id' => $g->grade_level_id, 'level_id' => $g->gradeLevel?->level_id, 'academic_year_id' => $g->academic_year_id]),
            'majors' => Major::where('is_active', true)->orderBy('code')->get(['id', 'code', 'name']),
            'curricula' => Curriculum::where('is_active', true)->orderBy('name')->get()
                ->map(fn (Curriculum $c) => ['id' => $c->id, 'name' => $c->label()]),
            'exam_formats' => ExamFormat::where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'subjects' => Subject::where('is_active', true)->orderBy('kind')->orderBy('name')->get()
                ->map(fn (Subject $s) => ['id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'kind' => $s->kind, 'exam_format_id' => $s->exam_format_id, 'min_grade' => $s->min_grade, 'max_grade' => $s->max_grade, 'is_elective' => $s->is_elective]),
            'academic_years' => AcademicYear::orderByDesc('is_active')->orderByDesc('code')->get(['id', 'code', 'is_active']),
        ];
    }
}
