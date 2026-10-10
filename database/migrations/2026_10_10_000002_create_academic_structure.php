<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Struktur akademik berjenjang:
 *   jenjang (levels) -> tingkat (grade_levels) -> rombel (grades, per tahun ajaran)
 *   kurikulum (curricula), format ujian (exam_formats) + subtes (subjects.kind = subtest)
 *   keanggotaan siswa per tahun ajaran (enrollments) sebagai riwayat.
 *
 * Non-destruktif: kolom lama tetap ada. Data yang sudah ada dipetakan otomatis
 * (XII -> SMA tingkat 12, 12IPSEKO -> peminatan IPS + mapel pilihan Ekonomi, dst.).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('levels', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();      // SD | SMP | SMA
            $table->string('name', 50);
            $table->unsignedTinyInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('grade_levels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('level_id')->constrained()->restrictOnDelete();
            $table->unsignedTinyInteger('number')->unique();   // 1..12, skala kanonik
            $table->string('name', 30);                         // Kelas 10
            $table->string('intl_label', 30)->nullable();       // Grade 10 / Year 11
            $table->timestamps();
        });

        Schema::create('curricula', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);          // Kurikulum Merdeka, K13, Cambridge, IB
            $table->string('year_label', 50)->nullable(); // teks bebas: "2024", "2022-sekarang"
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['name', 'year_label']);
        });

        Schema::create('exam_formats', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();  // SNBT-2026
            $table->string('name', 100);           // UTBK-SNBT 2026
            $table->string('year_label', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('subjects', function (Blueprint $table) {
            $table->string('kind', 20)->default('school')->after('name');      // school | subtest
            $table->foreignId('exam_format_id')->nullable()->after('kind')->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('min_grade')->nullable()->after('exam_format_id'); // 1..12
            $table->unsignedTinyInteger('max_grade')->nullable()->after('min_grade');
            $table->boolean('is_elective')->default(false)->after('max_grade');          // mapel pilihan
        });

        Schema::table('grades', function (Blueprint $table) {
            $table->foreignId('grade_level_id')->nullable()->after('level')->constrained()->nullOnDelete();
            $table->foreignId('academic_year_id')->nullable()->after('grade_level_id')->constrained()->nullOnDelete();
        });

        Schema::table('students', function (Blueprint $table) {
            $table->foreignId('grade_level_id')->nullable()->after('grade_id')->constrained()->nullOnDelete();
            $table->foreignId('curriculum_id')->nullable()->after('major_id')->constrained()->nullOnDelete();
            $table->string('school_origin', 150)->nullable()->after('room');
            $table->string('school_type', 20)->nullable()->after('school_origin'); // negeri | swasta | internasional
            $table->json('elective_subject_ids')->nullable()->after('school_type');
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->foreignId('grade_level_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('grade_id')->nullable()->constrained()->nullOnDelete();      // rombel
            $table->foreignId('major_id')->nullable()->constrained()->nullOnDelete();      // peminatan
            $table->foreignId('curriculum_id')->nullable()->constrained()->nullOnDelete();
            $table->string('school_origin', 150)->nullable();
            $table->string('school_type', 20)->nullable();
            $table->json('elective_subject_ids')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'academic_year_id']);
        });

        Schema::table('question_banks', function (Blueprint $table) {
            $table->foreignId('grade_level_id')->nullable()->after('grade_id')->constrained()->nullOnDelete();
            $table->foreignId('curriculum_id')->nullable()->after('major_id')->constrained()->nullOnDelete();
            $table->foreignId('exam_format_id')->nullable()->after('curriculum_id')->constrained()->nullOnDelete();
        });

        Schema::table('exams', function (Blueprint $table) {
            $table->foreignId('grade_level_id')->nullable()->after('grade_id')->constrained()->nullOnDelete();
            $table->foreignId('exam_format_id')->nullable()->after('major_id')->constrained()->nullOnDelete();
        });

        $this->seedReference();
        $this->migrateExistingData();
    }

    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('grade_level_id');
            $table->dropConstrainedForeignId('exam_format_id');
        });
        Schema::table('question_banks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('grade_level_id');
            $table->dropConstrainedForeignId('curriculum_id');
            $table->dropConstrainedForeignId('exam_format_id');
        });
        Schema::dropIfExists('enrollments');
        Schema::table('students', function (Blueprint $table) {
            $table->dropConstrainedForeignId('grade_level_id');
            $table->dropConstrainedForeignId('curriculum_id');
            $table->dropColumn(['school_origin', 'school_type', 'elective_subject_ids']);
        });
        Schema::table('grades', function (Blueprint $table) {
            $table->dropConstrainedForeignId('grade_level_id');
            $table->dropConstrainedForeignId('academic_year_id');
        });
        Schema::table('subjects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('exam_format_id');
            $table->dropColumn(['kind', 'min_grade', 'max_grade', 'is_elective']);
        });
        Schema::dropIfExists('exam_formats');
        Schema::dropIfExists('curricula');
        Schema::dropIfExists('grade_levels');
        Schema::dropIfExists('levels');
    }

    /** Data referensi yang selalu ada: jenjang, tingkat, kurikulum, format UTBK-SNBT. */
    private function seedReference(): void
    {
        $now = now();
        $levels = [['SD', 'Sekolah Dasar', 1, 1, 6], ['SMP', 'Sekolah Menengah Pertama', 2, 7, 9], ['SMA', 'Sekolah Menengah Atas', 3, 10, 12]];
        foreach ($levels as [$code, $name, $sort, $from, $to]) {
            $levelId = DB::table('levels')->insertGetId(['code' => $code, 'name' => $name, 'sort' => $sort, 'created_at' => $now, 'updated_at' => $now]);
            for ($n = $from; $n <= $to; $n++) {
                DB::table('grade_levels')->insert([
                    'level_id' => $levelId, 'number' => $n, 'name' => "Kelas $n", 'intl_label' => "Grade $n",
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        foreach ([['Kurikulum 2013', '2013–2024'], ['Kurikulum Merdeka', '2022–sekarang'], ['Cambridge (IGCSE / A Level)', null], ['IB (International Baccalaureate)', null]] as [$name, $year]) {
            DB::table('curricula')->insert(['name' => $name, 'year_label' => $year, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
        }

        $snbt = DB::table('exam_formats')->insertGetId(['code' => 'SNBT-2026', 'name' => 'UTBK-SNBT 2026', 'year_label' => '2026', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
        DB::table('exam_formats')->insert(['code' => 'US', 'name' => 'Ujian Sekolah / Tryout Mapel', 'year_label' => null, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
        $subtests = [
            ['SNBT-PU', 'Penalaran Umum'], ['SNBT-PPU', 'Pengetahuan dan Pemahaman Umum'], ['SNBT-PBM', 'Pemahaman Bacaan dan Menulis'],
            ['SNBT-PK', 'Pengetahuan Kuantitatif'], ['SNBT-LBI', 'Literasi Bahasa Indonesia'], ['SNBT-LBE', 'Literasi Bahasa Inggris'], ['SNBT-PM', 'Penalaran Matematika'],
        ];
        foreach ($subtests as [$code, $name]) {
            if (!DB::table('subjects')->where('code', $code)->exists()) {
                DB::table('subjects')->insert([
                    'code' => $code, 'name' => $name, 'kind' => 'subtest', 'exam_format_id' => $snbt, 'min_grade' => 12, 'max_grade' => 12,
                    'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
    }

    /** Pemetaan data yang sudah ada (hasil impor BeeSmart) ke struktur baru. Aman dijalankan pada DB kosong. */
    private function migrateExistingData(): void
    {
        $now = now();
        $gradeLevelByNumber = DB::table('grade_levels')->pluck('id', 'number')->all();
        $roman = ['I' => 1, 'II' => 2, 'III' => 3, 'IV' => 4, 'V' => 5, 'VI' => 6, 'VII' => 7, 'VIII' => 8, 'IX' => 9, 'X' => 10, 'XI' => 11, 'XII' => 12];
        $activeYear = DB::table('academic_years')->where('is_active', true)->value('id');

        // --- rombel: tingkat dari angka Romawi di kode, tahun ajaran aktif
        foreach (DB::table('grades')->get() as $g) {
            $prefix = strtoupper(trim(explode('.', $g->code)[0]));
            $number = $roman[$prefix] ?? null;
            DB::table('grades')->where('id', $g->id)->update([
                'grade_level_id' => $number ? ($gradeLevelByNumber[$number] ?? null) : null,
                'academic_year_id' => $activeYear,
            ]);
        }

        // --- peminatan: 12IPSEKO -> IPS (+ mapel pilihan Ekonomi); smpall/sdall -> tidak ada
        $electiveMap = ['EKO' => 'Ekonomi', 'SOS' => 'Sosiologi', 'GEO' => 'Geografi', 'FIS' => 'Fisika', 'KIM' => 'Kimia', 'BIO' => 'Biologi'];
        $oldMajors = DB::table('majors')->get();
        $majorRemap = [];   // id lama -> ['major_id' => id IPA/IPS|null, 'elective' => kode mapel|null]
        $ensureMajor = function (string $code, string $name) use ($now) {
            $id = DB::table('majors')->where('code', $code)->value('id');

            return $id ?: DB::table('majors')->insertGetId(['code' => $code, 'name' => $name, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
        };
        foreach ($oldMajors as $m) {
            $code = strtoupper($m->code);
            if (preg_match('/^\d*(IPA|IPS)([A-Z]*)$/', $code, $mm)) {
                $majorRemap[$m->id] = ['major_id' => $ensureMajor($mm[1], $mm[1]), 'elective' => $electiveMap[$mm[2]] ?? null];
            } elseif (in_array($code, ['IPA', 'IPS', 'BAHASA'], true)) {
                $majorRemap[$m->id] = ['major_id' => $m->id, 'elective' => null];
            } else {
                $majorRemap[$m->id] = ['major_id' => null, 'elective' => null]; // smpall, sdall
            }
        }

        // --- mata pelajaran: satu entitas per mapel, kode lama -> nama kanonik + rentang tingkat
        $subjectCanon = [
            // kode lama => [kode baru, nama, min, max, pilihan?]
            'BINDO-SMA' => ['BINDO', 'Bahasa Indonesia', 1, 12, false],
            'BIND-SMPTO' => ['BINDO', 'Bahasa Indonesia', 1, 12, false],
            'MAT-SMPTO' => ['MAT', 'Matematika', 1, 12, false],
            'EKO-SMAIPS' => ['EKO', 'Ekonomi', 10, 12, true],
            'SOS-SMAIPS' => ['SOS', 'Sosiologi', 10, 12, true],
            'GEO-SMAIPS' => ['GEO', 'Geografi', 10, 12, true],
            'FIS-SMAIPA' => ['FIS', 'Fisika', 10, 12, true],
            'KIM-SMAIPA' => ['KIM', 'Kimia', 10, 12, true],
            'BIO-SMAIPA' => ['BIO', 'Biologi', 10, 12, true],
        ];
        $subjectRemap = []; // id lama -> id kanonik
        foreach (DB::table('subjects')->where('kind', 'school')->get() as $s) {
            $canon = $subjectCanon[strtoupper($s->code)] ?? null;
            if (!$canon) {
                continue;
            }
            [$code, $name, $min, $max, $elective] = $canon;
            $existing = DB::table('subjects')->where('code', $code)->first();
            if ($existing && $existing->id !== $s->id) {
                $subjectRemap[$s->id] = $existing->id;      // gabung ke yang sudah ada (mis. Bahasa Indonesia SMP -> BINDO)
            } else {
                DB::table('subjects')->where('id', $s->id)->update([
                    'code' => $code, 'name' => $name, 'min_grade' => $min, 'max_grade' => $max, 'is_elective' => $elective,
                ]);
                $subjectRemap[$s->id] = $s->id;
            }
        }
        $subjectIdByCode = DB::table('subjects')->pluck('id', 'code')->all();

        // --- bank soal: tingkat dari peminatan lama (12 -> 12) atau dari jenjang di kode mapel lama; mapel ke kanonik; format = Ujian Sekolah
        $usFormat = DB::table('exam_formats')->where('code', 'US')->value('id');
        foreach (DB::table('question_banks')->get() as $b) {
            $oldMajor = $b->major_id ? $oldMajors->firstWhere('id', $b->major_id) : null;
            $number = null;
            if ($oldMajor && preg_match('/^(\d+)/', $oldMajor->code, $mm)) {
                $number = (int) $mm[1];
            } elseif ($oldMajor && strtolower($oldMajor->code) === 'smpall') {
                $number = 9;
            } elseif ($oldMajor && strtolower($oldMajor->code) === 'sdall') {
                $number = 6;
            } elseif (preg_match('/-SMP/i', $b->code)) {
                $number = 9;
            } elseif (preg_match('/-SMA|-IPA|-IPS/i', $b->code)) {
                $number = 12;
            }
            DB::table('question_banks')->where('id', $b->id)->update([
                'subject_id' => $subjectRemap[$b->subject_id] ?? $b->subject_id,
                'grade_level_id' => $number ? ($gradeLevelByNumber[$number] ?? null) : null,
                'major_id' => $oldMajor ? ($majorRemap[$oldMajor->id]['major_id'] ?? null) : null,
                'grade_id' => null,                 // bank tidak lagi menyasar rombel
                'exam_format_id' => $usFormat,
            ]);
        }

        // --- siswa: tingkat dari rombel, peminatan + mapel pilihan dari jurusan lama; keanggotaan awal untuk tahun aktif
        $gradeLevelOfGrade = DB::table('grades')->pluck('grade_level_id', 'id')->all();
        foreach (DB::table('students')->get() as $s) {
            $remap = $s->major_id ? ($majorRemap[$s->major_id] ?? ['major_id' => null, 'elective' => null]) : ['major_id' => null, 'elective' => null];
            $electiveIds = [];
            if ($remap['elective']) {
                $code = array_search($remap['elective'], array_column($subjectCanon, 1, 0)) ?: null;
                $elCode = collect($subjectCanon)->first(fn ($c) => $c[1] === $remap['elective'])[0] ?? null;
                if ($elCode && isset($subjectIdByCode[$elCode])) {
                    $electiveIds[] = $subjectIdByCode[$elCode];
                }
            }
            $gradeLevelId = $s->grade_id ? ($gradeLevelOfGrade[$s->grade_id] ?? null) : null;
            DB::table('students')->where('id', $s->id)->update([
                'grade_level_id' => $gradeLevelId,
                'major_id' => $remap['major_id'],
                'elective_subject_ids' => $electiveIds ? json_encode($electiveIds) : null,
            ]);
            if ($activeYear) {
                DB::table('enrollments')->insert([
                    'student_id' => $s->id, 'academic_year_id' => $activeYear, 'grade_level_id' => $gradeLevelId,
                    'grade_id' => $s->grade_id, 'major_id' => $remap['major_id'], 'curriculum_id' => null,
                    'elective_subject_ids' => $electiveIds ? json_encode($electiveIds) : null,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // --- jadwal: tingkat dari rombel lama atau dari peminatan lama; peminatan dipetakan; rombel dipertahankan bila ada
        foreach (DB::table('exams')->get() as $e) {
            $oldMajor = $e->major_id ? $oldMajors->firstWhere('id', $e->major_id) : null;
            $gradeLevelId = $e->grade_id ? ($gradeLevelOfGrade[$e->grade_id] ?? null) : null;
            if (!$gradeLevelId && $oldMajor && preg_match('/^(\d+)/', $oldMajor->code, $mm)) {
                $gradeLevelId = $gradeLevelByNumber[(int) $mm[1]] ?? null;
            }
            if (!$gradeLevelId) {
                $gradeLevelId = DB::table('question_banks')->where('id', $e->question_bank_id)->value('grade_level_id');
            }
            DB::table('exams')->where('id', $e->id)->update([
                'grade_level_id' => $gradeLevelId,
                'major_id' => $oldMajor ? ($majorRemap[$oldMajor->id]['major_id'] ?? null) : null,
                'exam_format_id' => $usFormat,
            ]);
        }

        // --- hapus peminatan lama yang sudah dipetakan (12IPSEKO, smpall, dst.) dan mapel lama yang digabung
        foreach ($oldMajors as $m) {
            $target = $majorRemap[$m->id]['major_id'] ?? null;
            if ($target !== $m->id) {
                DB::table('grades')->where('major_id', $m->id)->update(['major_id' => $target]);
                DB::table('majors')->where('id', $m->id)->delete();
            }
        }
        foreach ($subjectRemap as $old => $new) {
            if ($old !== $new) {
                DB::table('subjects')->where('id', $old)->delete();
            }
        }
    }
};
