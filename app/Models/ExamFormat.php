<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Format ujian berversi: UTBK-SNBT 2026, Ujian Sekolah, IGCSE, ... */
class ExamFormat extends Model
{
    protected $fillable = ['code', 'name', 'year_label', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** Subtes milik format ini (subjects dengan kind = subtest). */
    public function subtests(): HasMany
    {
        return $this->hasMany(Subject::class)->where('kind', Subject::KIND_SUBTEST)->orderBy('id');
    }
}
