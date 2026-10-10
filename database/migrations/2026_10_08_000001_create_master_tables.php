<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // admin | guru | proktor
            $table->string('role', 20)->default('admin')->after('email');
            $table->boolean('is_active')->default(true)->after('role');
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('academic_years', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        Schema::create('majors', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();      // XII.A
            $table->string('name', 100);               // 12A-ICT Art & Desain
            $table->string('level', 10)->nullable();   // SD | SMP | SMA | SMK
            $table->foreignId('major_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->string('exam_number', 30)->unique();   // nomor peserta = username
            $table->string('nisn', 30)->nullable();
            $table->string('name', 150);
            $table->char('gender', 1)->nullable();          // L | P
            $table->string('password');
            $table->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('major_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('academic_year_id')->nullable()->constrained()->nullOnDelete();
            $table->string('class_name', 60)->nullable();  // nama rombel bebas
            $table->unsignedTinyInteger('session_no')->default(1);
            $table->string('room', 30)->nullable();
            $table->string('photo')->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();

            $table->index(['grade_id', 'major_id']);
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('students');
        Schema::dropIfExists('subjects');
        Schema::dropIfExists('grades');
        Schema::dropIfExists('majors');
        Schema::dropIfExists('academic_years');
        Schema::dropIfExists('settings');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};
