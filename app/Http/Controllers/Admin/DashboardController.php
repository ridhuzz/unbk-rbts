<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Student;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $today = Exam::whereDate('exam_date', today())
            ->with('questionBank.subject')
            ->withCount([
                'attempts',
                'attempts as in_progress_count' => fn ($q) => $q->where('status', ExamAttempt::STATUS_IN_PROGRESS),
                'attempts as finished_count' => fn ($q) => $q->whereIn('status', [ExamAttempt::STATUS_FINISHED, ExamAttempt::STATUS_FORCE_FINISHED]),
            ])
            ->orderBy('start_time')
            ->get();

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'students' => Student::where('is_active', true)->count(),
                'question_banks' => QuestionBank::count(),
                'questions' => Question::count(),
                'exams_active' => Exam::active()->count(),
            ],
            'today_exams' => $today->map(fn (Exam $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'subject' => $e->questionBank->subject->name,
                'start_time' => substr($e->start_time, 0, 5),
                'late_limit_time' => substr($e->late_limit_time, 0, 5),
                'status' => $e->status,
                'window' => $e->windowState(),
                'token' => $e->token,
                'attempts_count' => $e->attempts_count,
                'in_progress_count' => $e->in_progress_count,
                'finished_count' => $e->finished_count,
            ]),
        ]);
    }
}
