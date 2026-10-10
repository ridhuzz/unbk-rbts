<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->guard('student')->check()) {
        return redirect()->route('siswa.ujian.index');
    }

    return auth()->check() ? redirect()->route('admin.dashboard') : redirect()->route('siswa.login');
})->name('home');

Route::middleware(['auth:web'])->get('dashboard', fn () => redirect()->route('admin.dashboard'))->name('dashboard');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
