<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pakai: ->middleware('role:admin') atau 'role:admin,guru'
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user('web');
        abort_unless($user && $user->is_active, 403, 'Akun tidak aktif.');
        abort_unless(in_array($user->role, $roles, true), 403, 'Anda tidak punya akses ke halaman ini.');

        return $next($request);
    }
}
