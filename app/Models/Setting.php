<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public const DEFAULTS = [
        'school_name' => 'RBTS UNBK / CBT',
        'school_level' => 'SMA',
        'school_tagline' => 'Bimbingan Belajar Terpercaya',
        'school_address' => '',
        'school_phone' => '',
        'school_website' => '',
        'admin_name' => '',
        'logo' => null,
        'banner' => null,
        'theme_color' => '#1d4ed8',
        'timezone' => 'Asia/Jakarta',
        'idle_minutes' => '5',
    ];

    public static function all_(): array
    {
        return Cache::remember('settings.all', 300, function () {
            $stored = static::query()->pluck('value', 'key')->all();

            return array_merge(self::DEFAULTS, $stored);
        });
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::all_()[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget('settings.all');
    }
}
