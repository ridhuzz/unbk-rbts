<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: [__DIR__.'/../routes/web.php', __DIR__.'/../routes/unbk.php'],
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);
        $middleware->redirectGuestsTo(fn ($request) => $request->is('siswa*') ? route('siswa.login') : route('login'));
        $middleware->redirectUsersTo(fn ($request) => $request->is('siswa*') ? route('siswa.ujian.index') : route('admin.dashboard'));
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
