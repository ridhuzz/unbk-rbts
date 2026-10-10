<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Tingkat kanonik 1–12, milik satu jenjang. */
class GradeLevel extends Model
{
    protected $fillable = ['level_id', 'number', 'name', 'intl_label'];

    protected function casts(): array
    {
        return ['number' => 'integer'];
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }

    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class);
    }

    public function label(): string
    {
        return $this->level ? "{$this->level->code} · {$this->name}" : $this->name;
    }
}
