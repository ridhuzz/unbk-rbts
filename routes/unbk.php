<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ExamController;
use App\Http\Controllers\Admin\ExamMonitorController;
use App\Http\Controllers\Admin\ExamResultController;
use App\Http\Controllers\Admin\MasterController;
use App\Http\Controllers\Admin\QuestionBankController;
use App\Http\Controllers\Admin\QuestionController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\StudentController;
use App\Http\Controllers\Student\AuthController as StudentAuthController;
use App\Http\Controllers\Student\ExamController as StudentExamController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Peserta (guard: student)
|--------------------------------------------------------------------------
*/
Route::prefix('siswa')->name('siswa.')->group(function () {
    Route::get('login', [StudentAuthController::class, 'create'])->name('login');
    Route::post('login', [StudentAuthController::class, 'store'])->middleware('throttle:10,1')->name('login.store');

    Route::middleware('auth:student')->group(function () {
        Route::post('logout', [StudentAuthController::class, 'destroy'])->name('logout');

        Route::prefix('ujian')->name('ujian.')->group(function () {
            Route::get('/', [StudentExamController::class, 'index'])->name('index');
            Route::post('mulai', [StudentExamController::class, 'start'])->middleware('throttle:20,1')->name('mulai');
            Route::get('kerjakan', [StudentExamController::class, 'work'])->name('kerjakan');
            Route::post('jawab', [StudentExamController::class, 'answer'])->name('jawab');
            Route::get('status', [StudentExamController::class, 'status'])->name('status');
            Route::post('selesai', [StudentExamController::class, 'finish'])->name('finish');
            Route::get('selesai/{attempt}', [StudentExamController::class, 'finished'])->name('selesai');
        });
    });
});

/*
|--------------------------------------------------------------------------
| Panel admin / guru / proktor (guard: web)
|--------------------------------------------------------------------------
*/
// guard "web" disebut eksplisit: sesi peserta (guard "student") tidak boleh dianggap login panel
Route::prefix('admin')->name('admin.')->middleware(['auth:web', 'verified'])->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');

    // Jadwal ujian: dipakai admin, guru, dan proktor
    Route::middleware('role:admin,guru,proktor')->group(function () {
        Route::get('exams', [ExamController::class, 'index'])->name('exams.index');
        Route::get('exams/{exam}/monitor', [ExamMonitorController::class, 'show'])->name('exams.monitor');
        Route::get('exams/{exam}/monitor/data', [ExamMonitorController::class, 'data'])->name('exams.monitor.data');
        Route::post('exams/{exam}/attempts/{attempt}/reset', [ExamMonitorController::class, 'reset'])->name('exams.attempts.reset');
        Route::post('exams/{exam}/attempts/{attempt}/add-time', [ExamMonitorController::class, 'addTime'])->name('exams.attempts.add-time');
        Route::post('exams/{exam}/attempts/{attempt}/force-finish', [ExamMonitorController::class, 'forceFinish'])->name('exams.attempts.force-finish');
        Route::post('exams/{exam}/attempts/{attempt}/reopen', [ExamMonitorController::class, 'reopen'])->name('exams.attempts.reopen');
        Route::post('exams/{exam}/status', [ExamController::class, 'setStatus'])->name('exams.status');
        Route::post('exams/{exam}/token', [ExamController::class, 'regenerateToken'])->name('exams.token');
        Route::post('exams/{exam}/toggle-token', [ExamController::class, 'toggleToken'])->name('exams.toggle-token');

        Route::get('exams/{exam}/results', [ExamResultController::class, 'show'])->name('exams.results');
        Route::get('exams/{exam}/results/export', [ExamResultController::class, 'export'])->name('exams.results.export');
        Route::get('exams/{exam}/attempts/{attempt}', [ExamResultController::class, 'attempt'])->name('exams.attempts.show');
    });

    // Admin & guru: kelola konten
    Route::middleware('role:admin,guru')->group(function () {
        Route::get('exams/create', [ExamController::class, 'create'])->name('exams.create');
        Route::post('exams', [ExamController::class, 'store'])->name('exams.store');
        Route::get('exams/{exam}/edit', [ExamController::class, 'edit'])->name('exams.edit');
        Route::put('exams/{exam}', [ExamController::class, 'update'])->name('exams.update');
        Route::delete('exams/{exam}', [ExamController::class, 'destroy'])->name('exams.destroy');
        Route::post('exams/{exam}/results/regrade', [ExamResultController::class, 'regrade'])->name('exams.results.regrade');
        Route::post('exams/{exam}/results/publish', [ExamResultController::class, 'publish'])->name('exams.results.publish');
        Route::post('exams/{exam}/attempts/{attempt}/grade-essay', [ExamResultController::class, 'gradeEssay'])->name('exams.attempts.grade-essay');

        Route::get('banks', [QuestionBankController::class, 'index'])->name('banks.index');
        Route::post('banks', [QuestionBankController::class, 'store'])->name('banks.store');
        Route::get('banks/{bank}', [QuestionBankController::class, 'show'])->name('banks.show');
        Route::put('banks/{bank}', [QuestionBankController::class, 'update'])->name('banks.update');
        Route::delete('banks/{bank}', [QuestionBankController::class, 'destroy'])->name('banks.destroy');
        Route::post('banks/{bank}/duplicate', [QuestionBankController::class, 'duplicate'])->name('banks.duplicate');
        Route::post('banks/{bank}/questions', [QuestionController::class, 'store'])->name('questions.store');
        Route::put('banks/{bank}/questions/{question}', [QuestionController::class, 'update'])->name('questions.update');
        Route::delete('banks/{bank}/questions/{question}', [QuestionController::class, 'destroy'])->name('questions.destroy');
        Route::post('questions/upload', [QuestionController::class, 'upload'])->name('questions.upload');
    });

    // Admin saja: master, peserta, pengaturan
    Route::middleware('role:admin')->group(function () {
        Route::get('masters', [MasterController::class, 'index'])->name('masters.index');
        Route::post('masters/{type}', [MasterController::class, 'store'])->name('masters.store');
        Route::put('masters/{type}/{id}', [MasterController::class, 'update'])->name('masters.update');
        Route::delete('masters/{type}/{id}', [MasterController::class, 'destroy'])->name('masters.destroy');

        Route::get('students', [StudentController::class, 'index'])->name('students.index');
        Route::post('students', [StudentController::class, 'store'])->name('students.store');
        Route::post('students/promote', [StudentController::class, 'promote'])->name('students.promote');
        Route::get('students/{student}', [StudentController::class, 'show'])->name('students.show');
        Route::put('students/{student}', [StudentController::class, 'update'])->name('students.update');
        Route::delete('students/{student}', [StudentController::class, 'destroy'])->name('students.destroy');
        Route::post('students/{student}/reset-password', [StudentController::class, 'resetPassword'])->name('students.reset-password');

        Route::get('settings/school', [SettingController::class, 'index'])->name('settings.school');
        Route::post('settings/school', [SettingController::class, 'update'])->name('settings.school.update');
        Route::post('settings/users', [SettingController::class, 'storeUser'])->name('settings.users.store');
        Route::put('settings/users/{user}', [SettingController::class, 'updateUser'])->name('settings.users.update');
        Route::delete('settings/users/{user}', [SettingController::class, 'destroyUser'])->name('settings.users.destroy');
    });
});
