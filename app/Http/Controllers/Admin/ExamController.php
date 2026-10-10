<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamLog;
use App\Models\Grade;
use App\Models\Major;
use App\Models\Question;
use App\Models\QuestionBank;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ExamController extends Controller
{
    public function index(Request $request): Response
    {
        $q = Exam::query()->with(['questionBank:id,code,name,subject_id', 'questionBank.subject:id,name', 'grade:id,code', 'major:id,code', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code', 'examFormat:id,name'])
            ->withCount([
                'attempts',
                'attempts as finished_count' => fn ($w) => $w->whereIn('status', [ExamAttempt::STATUS_FINISHED, ExamAttempt::STATUS_FORCE_FINISHED]),
            ]);
        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('name', 'like', "%$s%")->orWhere('code', 'like', "%$s%"));
        }
        if ($st = $request->query('status')) {
            $q->where('status', $st);
        }

        return Inertia::render('admin/exams/index', [
            'exams' => $q->orderByDesc('exam_date')->orderByDesc('start_time')->paginate(20)->withQueryString()
                ->through(fn (Exam $e) => $this->row($e)),
            'filters' => $request->only(['q', 'status']),
        ] + $this->formOptions());
    }

    public function create(): Response
    {
        return Inertia::render('admin/exams/form', [
            'exam' => null,
        ] + $this->formOptions());
    }

    public function edit(Exam $exam): Response
    {
        $exam->loadCount('attempts');

        return Inertia::render('admin/exams/form', [
            'exam' => $this->row($exam),
            'readiness' => $exam->readinessProblems(),
        ] + $this->formOptions());
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $data['token'] = $data['token'] ?: Exam::generateToken();
        $this->guardReadiness(new Exam($data), $data['status']);
        $exam = Exam::create($data);
        ExamLog::record('created', null, $exam, [], 'user', $request->user()->id);

        return redirect()->route('admin.exams.index')->with('success', "Jadwal ujian {$exam->name} dibuat. Token: {$exam->token}");
    }

    public function update(Request $request, Exam $exam): RedirectResponse
    {
        $data = $this->validated($request, $exam);
        $data['token'] = $data['token'] ?: $exam->token;
        if ($data['status'] !== $exam->status && ($blocker = $exam->transitionBlocker($data['status']))) {
            throw ValidationException::withMessages(['status' => $blocker]);
        }
        $candidate = (clone $exam)->fill($data);
        $this->guardReadiness($candidate, $data['status']);
        $exam->update($data);
        ExamLog::record('updated', null, $exam, ['changes' => array_keys($exam->getChanges())], 'user', $request->user()->id);

        return redirect()->route('admin.exams.index')->with('success', 'Jadwal ujian diperbarui.');
    }

    /**
     * Jumlah soal harus tersedia di bank; bila status aktif, semua syarat kesiapan harus terpenuhi.
     */
    private function guardReadiness(Exam $candidate, string $status): void
    {
        $candidate->setRelation('questionBank', QuestionBank::find($candidate->question_bank_id));
        $problems = $candidate->readinessProblems();
        if ($status !== Exam::STATUS_ACTIVE) {
            // saat draft cukup cegah jumlah soal melebihi isi bank
            $problems = array_values(array_filter($problems, fn ($p) => str_contains($p, 'bank hanya punya')));
        }
        if ($problems) {
            throw ValidationException::withMessages(['mc_count' => implode(' ', $problems)]);
        }
    }

    public function destroy(Exam $exam): RedirectResponse
    {
        if ($exam->attempts()->exists()) {
            return back()->with('error', 'Sudah ada peserta yang mengerjakan. Ubah status ke selesai saja.');
        }
        $exam->delete();

        return back()->with('success', 'Jadwal ujian dihapus.');
    }

    public function setStatus(Request $request, Exam $exam): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([Exam::STATUS_DRAFT, Exam::STATUS_ACTIVE, Exam::STATUS_FINISHED])],
        ]);
        if ($blocker = $exam->transitionBlocker($data['status'])) {
            return back()->with('error', $blocker);
        }
        $exam->update(['status' => $data['status']]);
        ExamLog::record('status:' . $data['status'], null, $exam, [], 'user', $request->user()->id);

        $label = ['draft' => 'draft', 'active' => 'aktif', 'finished' => 'selesai'][$data['status']];

        return back()->with('success', "Status ujian diubah menjadi {$label}.");
    }

    public function regenerateToken(Exam $exam): RedirectResponse
    {
        $exam->update(['token' => Exam::generateToken()]);

        return back()->with('success', "Token baru: {$exam->token}");
    }

    public function toggleToken(Exam $exam): RedirectResponse
    {
        $exam->update(['show_token' => !$exam->show_token]);

        return back()->with('success', $exam->show_token ? 'Token ditampilkan ke peserta.' : 'Token disembunyikan.');
    }

    private function formOptions(): array
    {
        return [
            'banks' => QuestionBank::where('is_active', true)->with(['subject:id,name', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code'])
                ->withCount([
                    'questions as mc_total' => fn ($q) => $q->where('type', Question::TYPE_MC),
                    'questions as essay_total' => fn ($q) => $q->where('type', Question::TYPE_ESSAY),
                ])->orderBy('grade_level_id')->orderBy('code')->get()
                ->map(fn ($b) => [
                    'id' => $b->id, 'code' => $b->code, 'name' => $b->name,
                    'subject' => $b->subject?->name, 'mc_total' => $b->mc_total, 'essay_total' => $b->essay_total,
                    'grade_level_id' => $b->grade_level_id, 'level_id' => $b->gradeLevel?->level_id,
                    'tingkat' => $b->gradeLevel ? "{$b->gradeLevel->level->code} {$b->gradeLevel->number}" : null,
                    'exam_format_id' => $b->exam_format_id, 'major_id' => $b->major_id,
                ]),
        ] + MasterController::academicOptions();
    }

    private function row(Exam $e): array
    {
        return [
            'id' => $e->id,
            'code' => $e->code,
            'name' => $e->name,
            'question_bank_id' => $e->question_bank_id,
            'bank' => $e->questionBank?->code,
            'subject' => $e->questionBank?->subject?->name,
            'academic_year_id' => $e->academic_year_id,
            'exam_format_id' => $e->exam_format_id,
            'exam_format' => $e->examFormat?->name,
            'level_id' => $e->gradeLevel?->level_id,
            'grade_level_id' => $e->grade_level_id,
            'tingkat' => $e->gradeLevel ? "{$e->gradeLevel->level->code} {$e->gradeLevel->number}" : null,
            'grade_id' => $e->grade_id,
            'grade' => $e->grade?->code,
            'major_id' => $e->major_id,
            'major' => $e->major?->code,
            'session_no' => $e->session_no,
            'exam_date' => $e->exam_date->format('Y-m-d'),
            'start_time' => substr($e->start_time, 0, 5),
            'late_limit_time' => substr($e->late_limit_time, 0, 5),
            'duration_minutes' => $e->duration_minutes,
            'late_policy' => $e->late_policy,
            'token' => $e->token,
            'show_token' => $e->show_token,
            'shuffle_questions' => $e->shuffle_questions,
            'shuffle_options' => $e->shuffle_options,
            'mc_count' => $e->mc_count,
            'essay_count' => $e->essay_count,
            'mc_weight_percent' => $e->mc_weight_percent,
            'essay_weight_percent' => $e->essay_weight_percent,
            'status' => $e->status,
            'window' => $e->windowState(),
            'proctor_name' => $e->proctor_name,
            'supervisor_name' => $e->supervisor_name,
            'notes' => $e->notes,
            'instructions' => $e->instructions,
            'results_published_at' => $e->results_published_at?->toIso8601String(),
            'attempts_count' => $e->attempts_count ?? 0,
            'finished_count' => $e->finished_count ?? 0,
        ];
    }

    private function validated(Request $request, ?Exam $exam = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:30'],
            'name' => ['required', 'string', 'max:150'],
            'question_bank_id' => ['required', 'integer', 'exists:question_banks,id'],
            'academic_year_id' => ['nullable', 'integer', 'exists:academic_years,id'],
            'exam_format_id' => ['nullable', 'integer', 'exists:exam_formats,id'],
            'grade_level_id' => ['nullable', 'integer', 'exists:grade_levels,id'],
            'grade_id' => ['nullable', 'integer', 'exists:grades,id'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
            'session_no' => ['nullable', 'integer', 'min:1', 'max:20'],
            'exam_date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'late_limit_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:600'],
            'late_policy' => ['required', Rule::in(['full', 'reduced'])],
            'token' => ['nullable', 'string', 'max:10', 'alpha_num'],
            'show_token' => ['nullable', 'boolean'],
            'shuffle_questions' => ['nullable', 'boolean'],
            'shuffle_options' => ['nullable', 'boolean'],
            'mc_count' => ['required', 'integer', 'min:0', 'max:500'],
            'essay_count' => ['required', 'integer', 'min:0', 'max:100'],
            'mc_weight_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'essay_weight_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'status' => ['nullable', Rule::in([Exam::STATUS_DRAFT, Exam::STATUS_ACTIVE, Exam::STATUS_FINISHED])],
            'proctor_name' => ['nullable', 'string', 'max:100'],
            'supervisor_name' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'instructions' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($data['mc_weight_percent'] + $data['essay_weight_percent'] !== 100) {
            throw \Illuminate\Validation\ValidationException::withMessages(['mc_weight_percent' => 'Bobot PG + esai harus 100%.']);
        }
        if ($data['mc_count'] + $data['essay_count'] === 0) {
            throw \Illuminate\Validation\ValidationException::withMessages(['mc_count' => 'Jumlah soal tidak boleh nol.']);
        }
        // rombel harus satu tingkat dengan target tingkat; format ujian mengikuti bank bila kosong
        if (!empty($data['grade_id']) && !empty($data['grade_level_id'])) {
            $g = Grade::find($data['grade_id']);
            if ($g && $g->grade_level_id && (int) $g->grade_level_id !== (int) $data['grade_level_id']) {
                throw ValidationException::withMessages(['grade_id' => 'Rombel yang dipilih bukan untuk tingkat ini.']);
            }
        }
        $bank = QuestionBank::find($data['question_bank_id']);
        $data['exam_format_id'] = $data['exam_format_id'] ?? $bank?->exam_format_id;
        $data['grade_level_id'] = $data['grade_level_id'] ?? $bank?->grade_level_id;
        $data['code'] = strtoupper(trim($data['code']));
        $data['token'] = isset($data['token']) ? strtoupper(trim($data['token'])) : null;
        $data['start_time'] .= ':00';
        $data['late_limit_time'] .= ':00';
        foreach (['show_token', 'shuffle_questions', 'shuffle_options'] as $b) {
            $data[$b] = (bool) ($data[$b] ?? false);
        }
        $data['status'] = $data['status'] ?? ($exam?->status ?? Exam::STATUS_DRAFT);

        return $data;
    }
}
