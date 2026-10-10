<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Subject;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class QuestionBankController extends Controller
{
    public function index(Request $request): Response
    {
        $q = QuestionBank::query()->with(['subject:id,code,name,kind', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code', 'major:id,code', 'curriculum:id,name,year_label', 'examFormat:id,code,name'])
            ->withCount(['questions', 'exams']);
        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('code', 'like', "%$s%")->orWhere('name', 'like', "%$s%"));
        }
        if ($sub = $request->integer('subject_id')) {
            $q->where('subject_id', $sub);
        }
        if ($gl = $request->integer('grade_level_id')) {
            $q->where('grade_level_id', $gl);
        }
        if ($f = $request->integer('exam_format_id')) {
            $q->where('exam_format_id', $f);
        }

        return Inertia::render('admin/question-banks/index', [
            'banks' => $q->orderBy('grade_level_id')->orderBy('code')->paginate(20)->withQueryString()->through(fn (QuestionBank $b) => $this->row($b)),
            'filters' => $request->only(['q', 'subject_id', 'grade_level_id', 'exam_format_id']),
        ] + MasterController::academicOptions());
    }

    public function show(QuestionBank $bank): Response
    {
        $bank->load(['subject:id,code,name', 'gradeLevel:id,number,level_id', 'gradeLevel.level:id,code', 'major:id,code', 'examFormat:id,name', 'curriculum:id,name,year_label']);

        return Inertia::render('admin/question-banks/show', [
            'bank' => [
                'id' => $bank->id,
                'code' => $bank->code,
                'name' => $bank->name,
                'subject' => $bank->subject?->name,
                'tingkat' => $bank->gradeLevel ? "{$bank->gradeLevel->level->code} {$bank->gradeLevel->number}" : null,
                'major' => $bank->major?->code,
                'exam_format' => $bank->examFormat?->name,
                'curriculum' => $bank->curriculum?->label(),
                'option_count' => $bank->option_count,
                'is_active' => $bank->is_active,
            ],
            'questions' => $bank->questions()->get()->map(fn (Question $q) => [
                'id' => $q->id,
                'number' => $q->number,
                'type' => $q->type,
                'body' => $q->body,
                'image' => $q->image ? asset('storage/' . $q->image) : null,
                'image_path' => $q->image,
                'audio' => $q->audio ? asset('storage/' . $q->audio) : null,
                'audio_path' => $q->audio,
                'options' => collect($q->options ?? [])->map(fn ($o) => [
                    'key' => $o['key'],
                    'body' => $o['body'] ?? '',
                    'image' => !empty($o['image']) ? asset('storage/' . $o['image']) : null,
                    'image_path' => $o['image'] ?? null,
                ])->values(),
                'answer_key' => $q->answer_key,
                'shuffle_options' => $q->shuffle_options,
                'weight' => (float) $q->weight,
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $bank = QuestionBank::create($data);

        return redirect()->route('admin.banks.show', $bank)->with('success', 'Bank soal dibuat.');
    }

    public function update(Request $request, QuestionBank $bank): RedirectResponse
    {
        $bank->update($this->validated($request, $bank));

        return back()->with('success', 'Bank soal diperbarui.');
    }

    public function destroy(QuestionBank $bank): RedirectResponse
    {
        if ($bank->exams()->exists()) {
            return back()->with('error', 'Bank soal sudah dipakai jadwal ujian dan tidak bisa dihapus.');
        }
        $bank->delete();

        return redirect()->route('admin.banks.index')->with('success', 'Bank soal dihapus.');
    }

    /**
     * Gandakan bank soal beserta soalnya.
     */
    public function duplicate(Request $request, QuestionBank $bank): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:question_banks,code'],
            'name' => ['required', 'string', 'max:150'],
        ]);
        $copy = $bank->replicate(['created_by']);
        $copy->fill(['code' => strtoupper($data['code']), 'name' => $data['name'], 'created_by' => $request->user()->id]);
        $copy->save();
        foreach ($bank->questions as $q) {
            $nq = $q->replicate();
            $nq->question_bank_id = $copy->id;
            $nq->save();
        }

        return redirect()->route('admin.banks.show', $copy)->with('success', 'Bank soal digandakan.');
    }

    private function row(QuestionBank $b): array
    {
        return [
            'id' => $b->id,
            'code' => $b->code,
            'name' => $b->name,
            'subject' => $b->subject?->name,
            'subject_id' => $b->subject_id,
            'subject_kind' => $b->subject?->kind,
            'level_id' => $b->gradeLevel?->level_id,
            'grade_level_id' => $b->grade_level_id,
            'tingkat' => $b->gradeLevel ? "{$b->gradeLevel->level->code} {$b->gradeLevel->number}" : null,
            'major' => $b->major?->code,
            'major_id' => $b->major_id,
            'curriculum_id' => $b->curriculum_id,
            'curriculum' => $b->curriculum?->label(),
            'exam_format_id' => $b->exam_format_id,
            'exam_format' => $b->examFormat?->name,
            'academic_year_id' => $b->academic_year_id,
            'option_count' => $b->option_count,
            'description' => $b->description,
            'is_active' => $b->is_active,
            'questions_count' => $b->questions_count ?? 0,
            'exams_count' => $b->exams_count ?? 0,
        ];
    }

    private function validated(Request $request, ?QuestionBank $bank = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('question_banks', 'code')->ignore($bank?->id)],
            'name' => ['required', 'string', 'max:150'],
            'exam_format_id' => ['required', 'integer', 'exists:exam_formats,id'],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'grade_level_id' => ['required', 'integer', 'exists:grade_levels,id'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
            'curriculum_id' => ['nullable', 'integer', 'exists:curricula,id'],
            'academic_year_id' => ['nullable', 'integer', 'exists:academic_years,id'],
            'option_count' => ['required', 'integer', 'min:2', 'max:5'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        // mata uji subtes harus milik format yang dipilih
        $subject = Subject::find($data['subject_id']);
        if ($subject && $subject->kind === Subject::KIND_SUBTEST && (int) $subject->exam_format_id !== (int) $data['exam_format_id']) {
            throw \Illuminate\Validation\ValidationException::withMessages(['subject_id' => 'Subtes ini bukan bagian dari format ujian yang dipilih.']);
        }
        $data['code'] = strtoupper(trim($data['code']));
        $data['is_active'] = $data['is_active'] ?? true;
        $data['grade_id'] = null;

        return $data;
    }
}
