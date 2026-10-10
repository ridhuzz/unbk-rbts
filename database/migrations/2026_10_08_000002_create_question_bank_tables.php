<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('question_banks', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();          // BINDO-SMA-LAT
            $table->string('name', 150);
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('major_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('academic_year_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('option_count')->default(5);
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_bank_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->string('type', 20)->default('multiple_choice'); // multiple_choice | essay
            $table->longText('body');                               // HTML
            $table->string('image')->nullable();
            $table->string('audio')->nullable();
            $table->string('video')->nullable();
            // [{"key":"A","body":"<p>..</p>","image":null}, ...]
            $table->json('options')->nullable();
            $table->char('answer_key', 1)->nullable();
            $table->boolean('shuffle_options')->default(true);
            $table->decimal('weight', 5, 2)->default(1);
            $table->timestamps();

            $table->unique(['question_bank_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_banks');
    }
};
