<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Kurikulum: nama + tahun berlaku sebagai teks bebas. */
class Curriculum extends Model
{
    protected $table = 'curricula';

    protected $fillable = ['name', 'year_label', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function label(): string
    {
        return $this->year_label ? "{$this->name} ({$this->year_label})" : $this->name;
    }
}
