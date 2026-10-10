<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function create(): Response|RedirectResponse
    {
        if (Auth::guard('student')->check()) {
            return redirect()->route('siswa.ujian.index');
        }

        return Inertia::render('siswa/login', [
            'school' => $this->school(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'exam_number' => ['required', 'string', 'max:30'],
            'password' => ['required', 'string'],
        ]);

        $ok = Auth::guard('student')->attempt([
            'exam_number' => trim($data['exam_number']),
            'password' => $data['password'],
            'is_active' => true,
        ]);

        if (!$ok) {
            throw ValidationException::withMessages([
                'exam_number' => 'Nomor peserta atau password salah.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->route('siswa.ujian.index');
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('student')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('siswa.login');
    }

    public static function school(): array
    {
        $s = Setting::all_();

        return [
            'name' => $s['school_name'],
            'level' => $s['school_level'],
            'tagline' => $s['school_tagline'] ?? '',
            'logo' => $s['logo'] ? asset('storage/' . $s['logo']) : null,
            'banner' => $s['banner'] ? asset('storage/' . $s['banner']) : null,
            'color' => $s['theme_color'],
        ];
    }
}
