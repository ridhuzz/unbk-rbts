<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penambahan non-destruktif: petunjuk pengerjaan untuk peserta dan penanda publikasi hasil.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->text('instructions')->nullable()->after('notes');
            $table->dateTime('results_published_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn(['instructions', 'results_published_at']);
        });
    }
};
