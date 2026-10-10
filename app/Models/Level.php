<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Jenjang: SD, SMP, SMA. */
class Level extends Model
{
    protected $fillable = ['code', 'name', 'sort'];

    public function gradeLevels(): HasMany
    {
        return $this->hasMany(GradeLevel::class)->orderBy('number');
    }
}
