<?php

namespace App\Providers;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->applyTimezoneFromSettings();
    }

    /**
     * Zona waktu diatur admin di menu Pengaturan; jadikan sumber tunggal untuk seluruh perhitungan waktu ujian.
     * Diabaikan dengan aman ketika database belum siap (mis. saat migrasi pertama atau pengujian).
     */
    private function applyTimezoneFromSettings(): void
    {
        try {
            if (!Schema::hasTable('settings')) {
                return;
            }
            $tz = Setting::get('timezone');
            if ($tz && in_array($tz, timezone_identifiers_list(), true)) {
                config(['app.timezone' => $tz]);
                date_default_timezone_set($tz);
            }
        } catch (\Throwable) {
            // koneksi DB belum tersedia: pakai APP_TIMEZONE dari .env
        }
    }
}
