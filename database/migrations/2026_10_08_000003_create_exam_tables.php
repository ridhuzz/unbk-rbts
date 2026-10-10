<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30);                      // TO1, UTS, ...
            $table->string('name', 150);
            $table->foreignId('question_bank_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->nullable()->constrained()->nullOnDelete();
            // null = semua kelas / jurusan / sesi
            $table->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('major_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('session_no')->nullable();

            $table->date('exam_date');
            $table->time('start_time');
            $table->time('late_limit_time');                 // batas masuk
            $table->unsignedInteger('duration_minutes');
            $table->string('late_policy', 10)->default('full'); // full | reduced

            $table->string('token', 10);
            $table->boolean('show_token')->default(false);
            $table->boolean('shuffle_questions')->default(true);
            $table->boolean('shuffle_options')->default(true);
            $table->unsignedInteger('mc_count')->default(0);
            $table->unsignedInteger('essay_count')->default(0);
            $table->unsignedTinyInteger('mc_weight_percent')->default(100);
            $table->unsignedTinyInteger('essay_weight_percent')->default(0);

            $table->string('status', 10)->default('draft');  // draft | active | finished
            $table->string('proctor_name', 100)->nullable();
            $table->string('supervisor_name', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['exam_date', 'status']);
        });

        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('session_token', 64);
            $table->dateTime('started_at');
            $table->dateTime('ends_at');
            $table->dateTime('finished_at')->nullable();
            $table->dateTime('last_seen_at')->nullable();
            $table->string('status', 20)->default('in_progress'); // in_progress | finished | force_finished
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->unsignedInteger('extra_minutes')->default(0);
            $table->json('question_order')->nullable();   // [question_id, ...] urutan tampil
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('wrong_count')->default(0);
            $table->unsignedInteger('unanswered_count')->default(0);
            $table->decimal('score_mc', 6, 2)->nullable();
            $table->decimal('score_essay', 6, 2)->nullable();
            $table->decimal('total_score', 6, 2)->nullable();
            $table->timestamps();

            $table->unique(['exam_id', 'student_id']);
            $table->index('session_token');
            $table->index(['exam_id', 'status']);
        });

        Schema::create('attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position');          // nomor tampil 1..n
            $table->json('option_order')->nullable();     // ["C","A","E","B","D"]
            $table->char('answer', 1)->nullable();        // kunci opsi asli yang dipilih
            $table->text('essay_answer')->nullable();
            $table->boolean('is_doubtful')->default(false);
            $table->boolean('is_correct')->nullable();
            $table->decimal('essay_score', 6, 2)->nullable();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'question_id']);
            $table->index(['exam_attempt_id', 'position']);
        });

        Schema::create('exam_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('exam_attempt_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('actor_type', 20)->nullable();  // student | user | system
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('event', 50);
            $table->json('meta')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->dateTime('created_at');

            $table->index(['exam_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_logs');
        Schema::dropIfExists('attempt_answers');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exams');
    }
};
