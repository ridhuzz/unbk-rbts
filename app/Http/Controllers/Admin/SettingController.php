<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    public function index(): Response
    {
        $s = Setting::all_();

        return Inertia::render('admin/settings/index', [
            'settings' => $s + [
                'logo_url' => $s['logo'] ? asset('storage/' . $s['logo']) : null,
                'banner_url' => $s['banner'] ? asset('storage/' . $s['banner']) : null,
            ],
            'users' => User::orderBy('name')->get(['id', 'name', 'email', 'role', 'is_active']),
            'timezones' => ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'school_name' => ['required', 'string', 'max:150'],
            'school_level' => ['nullable', 'string', 'max:10'],
            'school_tagline' => ['nullable', 'string', 'max:100'],
            'school_address' => ['nullable', 'string', 'max:500'],
            'school_phone' => ['nullable', 'string', 'max:50'],
            'school_website' => ['nullable', 'string', 'max:150'],
            'admin_name' => ['nullable', 'string', 'max:100'],
            'theme_color' => ['nullable', 'string', 'max:20'],
            'timezone' => ['required', Rule::in(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])],
            'idle_minutes' => ['required', 'integer', 'min:1', 'max:60'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'banner' => ['nullable', 'image', 'max:4096'],
        ]);

        foreach (['logo', 'banner'] as $f) {
            if ($request->hasFile($f)) {
                $data[$f] = $request->file($f)->store('branding', 'public');
            } else {
                unset($data[$f]);
            }
        }
        foreach ($data as $k => $v) {
            Setting::set($k, $v);
        }

        return back()->with('success', 'Pengaturan disimpan.');
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', Rule::in(['admin', 'guru', 'proktor'])],
        ]);
        User::create($data + ['is_active' => true]);

        return back()->with('success', 'Pengguna ditambahkan.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', Rule::in(['admin', 'guru', 'proktor'])],
            'is_active' => ['nullable', 'boolean'],
        ]);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        $data['is_active'] = $data['is_active'] ?? true;
        if ($user->id === $request->user()->id) {
            $data['role'] = 'admin';
            $data['is_active'] = true;
        }
        $user->update($data);

        return back()->with('success', 'Pengguna diperbarui.');
    }

    public function destroyUser(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Tidak bisa menghapus akun sendiri.');
        }
        $user->delete();

        return back()->with('success', 'Pengguna dihapus.');
    }
}
