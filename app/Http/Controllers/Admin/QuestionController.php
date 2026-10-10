<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\QuestionBank;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class QuestionController extends Controller
{
    public function store(Request $request, QuestionBank $bank): RedirectResponse
    {
        $data = $this->validated($request, $bank);
        $data['number'] = $data['number'] ?? (($bank->questions()->max('number') ?? 0) + 1);
        $bank->questions()->create($data);

        return back()->with('success', 'Soal ditambahkan.');
    }

    public function update(Request $request, QuestionBank $bank, Question $question): RedirectResponse
    {
        abort_unless($question->question_bank_id === $bank->id, 404);
        $question->update($this->validated($request, $bank, $question));

        return back()->with('success', 'Soal disimpan.');
    }

    public function destroy(QuestionBank $bank, Question $question): RedirectResponse
    {
        abort_unless($question->question_bank_id === $bank->id, 404);
        $question->delete();

        return back()->with('success', 'Soal dihapus.');
    }

    /**
     * Upload media (gambar/audio) untuk soal atau opsi. Mengembalikan path relatif + URL.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimes:jpg,jpeg,png,gif,webp,mp3,wav,ogg,mp4,webm'],
        ]);
        $file = $request->file('file');
        $dir = str_starts_with($file->getMimeType(), 'audio') ? 'questions/audio'
            : (str_starts_with($file->getMimeType(), 'video') ? 'questions/video' : 'questions');
        $path = $file->store($dir, 'public');

        return response()->json([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ]);
    }

    private function validated(Request $request, QuestionBank $bank, ?Question $question = null): array
    {
        $data = $request->validate([
            'number' => ['nullable', 'integer', 'min:1', Rule::unique('questions', 'number')
                ->where('question_bank_id', $bank->id)->ignore($question?->id)],
            'type' => ['required', Rule::in([Question::TYPE_MC, Question::TYPE_ESSAY])],
            'body' => ['required', 'string'],
            'image' => ['nullable', 'string', 'max:255'],
            'audio' => ['nullable', 'string', 'max:255'],
            'video' => ['nullable', 'string', 'max:255'],
            'options' => ['nullable', 'array', 'max:5'],
            'options.*.key' => ['required_with:options', 'string', 'size:1'],
            'options.*.body' => ['nullable', 'string'],
            'options.*.image' => ['nullable', 'string', 'max:255'],
            'answer_key' => ['nullable', 'string', 'size:1'],
            'shuffle_options' => ['nullable', 'boolean'],
            'weight' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        if ($data['type'] === Question::TYPE_MC) {
            $keys = collect($data['options'] ?? [])->pluck('key')->all();
            if (count($keys) < 2) {
                throw \Illuminate\Validation\ValidationException::withMessages(['options' => 'Minimal dua pilihan jawaban.']);
            }
            if (!in_array($data['answer_key'] ?? null, $keys, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['answer_key' => 'Kunci jawaban harus salah satu pilihan.']);
            }
        } else {
            $data['options'] = null;
            $data['answer_key'] = null;
        }
        $data['shuffle_options'] = $data['shuffle_options'] ?? true;
        $data['weight'] = $data['weight'] ?? 1;

        return $data;
    }
}
