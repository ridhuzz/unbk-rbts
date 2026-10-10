<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\Exam;
use App\Models\ExamFormat;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\Major;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Impor data dari database BeeSmart CBT lama (koneksi "legacy").
 *
 *   php artisan unbk:import-legacy --media=D:/MAMP/htdocs/rbts-unbk
 */
class ImportLegacyCommand extends Command
{
    protected $signature = 'unbk:import-legacy
        {--media= : Folder root aplikasi lama (berisi pictures/, audio/, video/, fotosiswa/)}
        {--fresh : Hapus data bank soal, siswa, master, dan jadwal yang ada sebelum impor}';

    protected $description = 'Impor master, siswa, bank soal, dan jadwal dari database BeeSmart CBT lama';

    private array $stats = [];

    public function handle(): int
    {
        $legacy = DB::connection('legacy');
        try {
            $legacy->getPdo();
        } catch (\Throwable $e) {
            $this->error('Tidak bisa konek ke database lama: ' . $e->getMessage());

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('Menghapus data yang ada...');
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            foreach (['exam_logs', 'attempt_answers', 'exam_attempts', 'exams', 'questions', 'question_banks', 'students', 'grades', 'majors', 'subjects', 'academic_years'] as $t) {
                DB::table($t)->truncate();
            }
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->importSettings($legacy);
        $this->importAcademicYears($legacy);
        $majors = $this->importMajors($legacy);
        $grades = $this->importGrades($legacy, $majors);
        $subjects = $this->importSubjects($legacy);
        $this->importStudents($legacy, $grades, $majors);
        $banks = $this->importQuestionBanks($legacy, $subjects, $grades, $majors);
        $this->importQuestions($legacy, $banks);
        $this->importExams($legacy, $banks, $grades, $majors);
        $this->importUsers($legacy);

        $this->newLine();
        $this->table(['Entitas', 'Jumlah'], collect($this->stats)->map(fn ($v, $k) => [$k, $v])->values()->all());

        return self::SUCCESS;
    }

    private function importSettings($legacy): void
    {
        $adm = $legacy->table('cbt_admin')->first();
        if (!$adm) {
            return;
        }
        Setting::set('school_name', $adm->XSekolah);
        Setting::set('school_level', $adm->XTingkat);
        Setting::set('school_address', trim("$adm->XAlamat $adm->XKec $adm->XKab $adm->XProp"));
        Setting::set('school_phone', $adm->XTelp);
        Setting::set('school_website', $adm->XWeb);
        Setting::set('admin_name', $adm->XAdmin);
        if ($adm->XWarna) {
            Setting::set('theme_color', $adm->XWarna);
        }
        foreach (['logo' => $adm->XLogo, 'banner' => $adm->XBanner] as $key => $file) {
            if ($file && ($path = $this->copyMedia('images/' . $file, 'branding'))) {
                Setting::set($key, $path);
            }
        }
        $zona = $legacy->table('cbt_zona')->value('XZona');
        if ($zona) {
            Setting::set('timezone', $zona);
        }
        $this->stats['settings'] = 1;
    }

    private function importAcademicYears($legacy): void
    {
        $n = 0;
        foreach ($legacy->table('cbt_setid')->get() as $r) {
            AcademicYear::updateOrCreate(
                ['code' => trim($r->XKodeAY)],
                ['name' => $r->XNamaAY ?: $r->XKodeAY, 'is_active' => $r->XStatus === '1']
            );
            $n++;
        }
        $this->stats['academic_years'] = $n;
    }

    /** Kode mapel lama -> [kode kanonik, nama, tingkat min, tingkat max, mapel pilihan?]. */
    private const SUBJECT_CANON = [
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

    private const ELECTIVE_CODES = ['EKO' => 'EKO', 'SOS' => 'SOS', 'GEO' => 'GEO', 'FIS' => 'FIS', 'KIM' => 'KIM', 'BIO' => 'BIO'];

    private const ROMAN = ['I' => 1, 'II' => 2, 'III' => 3, 'IV' => 4, 'V' => 5, 'VI' => 6, 'VII' => 7, 'VIII' => 8, 'IX' => 9, 'X' => 10, 'XI' => 11, 'XII' => 12];

    /**
     * "Jurusan" lama (12IPSEKO, smpall) dipecah menjadi peminatan IPA/IPS + mapel pilihan.
     * Mengembalikan peta kode lama => ['major_id' => ?, 'elective' => kode mapel|null, 'number' => tingkat|null].
     */
    private function importMajors($legacy): array
    {
        $codes = $legacy->table('cbt_siswa')->distinct()->pluck('XKodeJurusan')
            ->merge($legacy->table('cbt_kelas')->distinct()->pluck('XKodeJurusan'))
            ->merge($legacy->table('cbt_paketsoal')->distinct()->pluck('XKodeJurusan'))
            ->map(fn ($c) => trim((string) $c))
            ->filter(fn ($c) => $c !== '' && strtoupper($c) !== 'ALL')
            ->unique();

        $map = [];
        foreach ($codes as $code) {
            $u = strtoupper($code);
            if (preg_match('/^(\d*)(IPA|IPS|BAHASA)([A-Z]*)$/', $u, $m)) {
                $major = Major::firstOrCreate(['code' => $m[2]], ['name' => $m[2]]);
                $map[$code] = ['major_id' => $major->id, 'elective' => self::ELECTIVE_CODES[$m[3]] ?? null, 'number' => $m[1] !== '' ? (int) $m[1] : null];
            } elseif ($u === 'SMPALL') {
                $map[$code] = ['major_id' => null, 'elective' => null, 'number' => 9];
            } elseif ($u === 'SDALL') {
                $map[$code] = ['major_id' => null, 'elective' => null, 'number' => 6];
            } else {
                $major = Major::firstOrCreate(['code' => $u], ['name' => $code]);
                $map[$code] = ['major_id' => $major->id, 'elective' => null, 'number' => null];
            }
        }
        $this->stats['majors'] = Major::count();

        return $map;
    }

    private function gradeLevelIdForNumber(?int $number): ?int
    {
        static $byNumber = null;
        $byNumber ??= GradeLevel::pluck('id', 'number')->all();

        return $number ? ($byNumber[$number] ?? null) : null;
    }

    private function importGrades($legacy, array $majors): array
    {
        $map = [];
        foreach ($legacy->table('cbt_kelas')->get() as $r) {
            $code = trim($r->XKodeKelas);
            if ($code === '') {
                continue;
            }
            $number = self::ROMAN[strtoupper(trim(explode('.', $code)[0]))] ?? null;
            $g = Grade::updateOrCreate(
                ['code' => $code],
                [
                    'name' => trim($r->XNamaKelas) ?: $code,
                    'level' => trim($r->XKodeLevel) ?: null,
                    'grade_level_id' => $this->gradeLevelIdForNumber($number),
                    'academic_year_id' => AcademicYear::active()?->id,
                    'major_id' => $majors[trim($r->XKodeJurusan)]['major_id'] ?? null,
                    'is_active' => $r->XStatusKelas !== '0',
                ]
            );
            $map[$code] = $g->id;
        }
        // kelas yang hanya muncul di data siswa
        foreach ($legacy->table('cbt_siswa')->distinct()->pluck('XKodeKelas') as $code) {
            $code = trim((string) $code);
            if ($code !== '' && !isset($map[$code])) {
                $number = self::ROMAN[strtoupper(trim(explode('.', $code)[0]))] ?? null;
                $map[$code] = Grade::firstOrCreate(['code' => $code], ['name' => $code, 'grade_level_id' => $this->gradeLevelIdForNumber($number), 'academic_year_id' => AcademicYear::active()?->id])->id;
            }
        }
        $this->stats['grades'] = count($map);

        return $map;
    }

    private function importSubjects($legacy): array
    {
        $map = [];
        foreach ($legacy->table('cbt_mapel')->get() as $r) {
            $code = trim($r->XKodeMapel);
            if ($code === '') {
                continue;
            }
            // kode lama (BINDO-SMA, BIND-SMPTO) digabung ke satu mapel kanonik dengan rentang tingkat
            $canon = self::SUBJECT_CANON[strtoupper($code)] ?? [strtoupper($code), trim($r->XNamaMapel) ?: $code, null, null, false];
            [$newCode, $name, $min, $max, $elective] = $canon;
            $s = Subject::updateOrCreate(
                ['code' => $newCode],
                ['name' => $name, 'kind' => Subject::KIND_SCHOOL, 'min_grade' => $min, 'max_grade' => $max, 'is_elective' => $elective]
            );
            $map[$code] = $s->id;
        }
        $this->stats['subjects'] = Subject::where('kind', Subject::KIND_SCHOOL)->count();

        return $map;
    }

    private function importStudents($legacy, array $grades, array $majors): void
    {
        $years = AcademicYear::pluck('id', 'code')->all();
        $n = 0;
        $bar = $this->output->createProgressBar($legacy->table('cbt_siswa')->count());
        foreach ($legacy->table('cbt_siswa')->orderBy('Urut')->cursor() as $r) {
            $number = trim($r->XNomerUjian);
            if ($number === '') {
                $bar->advance();
                continue;
            }
            $photo = $r->XFoto ? $this->copyMedia('fotosiswa/' . $r->XFoto, 'students') : null;
            $gradeId = $grades[trim($r->XKodeKelas)] ?? null;
            $jurusan = $majors[trim($r->XKodeJurusan)] ?? ['major_id' => null, 'elective' => null, 'number' => null];
            $gradeLevelId = $gradeId ? Grade::find($gradeId)?->grade_level_id : $this->gradeLevelIdForNumber($jurusan['number']);
            $electiveId = $jurusan['elective'] ? Subject::where('code', $jurusan['elective'])->value('id') : null;
            $student = Student::updateOrCreate(
                ['exam_number' => $number],
                [
                    'nisn' => trim($r->XNIK) ?: null,
                    'name' => trim($r->XNamaSiswa),
                    'gender' => in_array($r->XJenisKelamin, ['L', 'P']) ? $r->XJenisKelamin : null,
                    'password' => Hash::make(trim($r->XPassword) !== '' ? trim($r->XPassword) : $number),
                    'grade_id' => $gradeId,
                    'grade_level_id' => $gradeLevelId,
                    'major_id' => $jurusan['major_id'],
                    'elective_subject_ids' => $electiveId ? [$electiveId] : null,
                    'academic_year_id' => AcademicYear::active()?->id ?? ($years[trim($r->XSetId)] ?? null),
                    'class_name' => trim($r->XNamaKelas) ?: null,
                    'session_no' => max(1, (int) $r->XSesi),
                    'room' => trim($r->XRuang) ?: null,
                    'photo' => $photo,
                    'is_active' => true,
                ]
            );
            $student->syncEnrollment(); // data awal: satu baris riwayat untuk tahun ajaran aktif
            $n++;
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();
        $this->stats['students'] = $n;
    }

    private function importQuestionBanks($legacy, array $subjects, array $grades, array $majors): array
    {
        $years = AcademicYear::pluck('id', 'code')->all();
        $map = [];
        $paket = $legacy->table('cbt_paketsoal')->get()->keyBy(fn ($p) => trim($p->XKodeSoal));

        // sumber kebenaran: kode soal yang ada di cbt_soal (ada paket tanpa soal dan sebaliknya)
        $codes = $legacy->table('cbt_soal')->select('XKodeSoal', 'XKodeMapel')
            ->groupBy('XKodeSoal', 'XKodeMapel')->get();

        foreach ($codes as $c) {
            $code = trim($c->XKodeSoal);
            if ($code === '') {
                continue;
            }
            $p = $paket[$code] ?? null;
            $subjectCode = trim($p->XKodeMapel ?? $c->XKodeMapel);
            $subjectId = $subjects[$subjectCode] ?? null;
            if (!$subjectId) {
                $subjectId = Subject::firstOrCreate(['code' => $subjectCode ?: 'UMUM'], ['name' => $subjectCode ?: 'Umum'])->id;
                $subjects[$subjectCode] = $subjectId;
            }
            $jurusan = $p ? ($majors[trim($p->XKodeJurusan)] ?? null) : null;
            $number = $jurusan['number'] ?? (preg_match('/-SMP/i', $code) ? 9 : (preg_match('/-SMA|-IPA|-IPS/i', $code) ? 12 : null));
            $bank = QuestionBank::updateOrCreate(
                ['code' => $code],
                [
                    'name' => $code,
                    'subject_id' => $subjectId,
                    'grade_id' => null,
                    'grade_level_id' => $this->gradeLevelIdForNumber($number),
                    'major_id' => $jurusan['major_id'] ?? null,
                    'exam_format_id' => ExamFormat::where('code', 'US')->value('id'),
                    'academic_year_id' => $p ? ($years[trim($p->XSetId)] ?? null) : null,
                    'option_count' => $p && (int) $p->XJumPilihan > 0 ? (int) $p->XJumPilihan : 5,
                    'is_active' => $p ? $p->XStatusSoal === 'Y' : true,
                ]
            );
            $map[$code] = $bank;
        }
        $this->stats['question_banks'] = count($map);

        return $map;
    }

    private function importQuestions($legacy, array $banks): void
    {
        $total = $legacy->table('cbt_soal')->count();
        $bar = $this->output->createProgressBar($total);
        $n = 0;
        $keys = ['A', 'B', 'C', 'D', 'E'];

        foreach ($legacy->table('cbt_soal')->orderBy('XKodeSoal')->orderBy('XNomerSoal')->cursor() as $r) {
            $bank = $banks[trim($r->XKodeSoal)] ?? null;
            if (!$bank) {
                $bar->advance();
                continue;
            }
            $isEssay = (int) $r->XJenisSoal === 2;
            $optionCount = min(5, max(2, $bank->option_count));

            $options = null;
            $answerKey = null;
            if (!$isEssay) {
                $options = [];
                for ($i = 1; $i <= $optionCount; $i++) {
                    $options[] = [
                        'key' => $keys[$i - 1],
                        'body' => $this->cleanHtml($r->{"XJawab$i"} ?? ''),
                        'image' => $this->copyMedia('pictures/' . ($r->{"XGambarJawab$i"} ?? ''), 'questions'),
                    ];
                }
                // kunci lama disimpan sebagai angka 1..5 (kadang huruf)
                $k = trim((string) $r->XKunciJawaban);
                if (ctype_digit($k) && (int) $k >= 1 && (int) $k <= 5) {
                    $answerKey = $keys[(int) $k - 1];
                } elseif (in_array(strtoupper($k), $keys, true)) {
                    $answerKey = strtoupper($k);
                }
            }

            Question::updateOrCreate(
                ['question_bank_id' => $bank->id, 'number' => (int) $r->XNomerSoal],
                [
                    'type' => $isEssay ? Question::TYPE_ESSAY : Question::TYPE_MC,
                    'body' => $this->cleanHtml($r->XTanya),
                    'image' => $this->copyMedia('pictures/' . $r->XGambarTanya, 'questions'),
                    'audio' => $this->copyMedia('audio/' . $r->XAudioTanya, 'questions/audio'),
                    'video' => $this->copyMedia('video/' . $r->XVideoTanya, 'questions/video'),
                    'options' => $options,
                    'answer_key' => $answerKey,
                    'shuffle_options' => ($r->XAcakOpsi ?? 'Y') !== 'N',
                ]
            );
            $n++;
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();
        $this->stats['questions'] = $n;
    }

    private function importExams($legacy, array $banks, array $grades, array $majors): void
    {
        $years = AcademicYear::pluck('id', 'code')->all();
        $n = 0;
        foreach ($legacy->table('cbt_ujian')->orderBy('Urut')->get() as $r) {
            $bank = $banks[trim($r->XKodeSoal)] ?? null;
            if (!$bank) {
                continue;
            }
            $status = match ((string) $r->XStatusUjian) {
                '1' => Exam::STATUS_ACTIVE,
                '9' => Exam::STATUS_FINISHED,
                default => Exam::STATUS_DRAFT,
            };
            [$h, $m] = array_map('intval', explode(':', ($r->XLamaUjian ?: '01:00:00') . ':0'));
            $duration = max(1, $h * 60 + $m);
            $sesi = trim((string) $r->XSesi);

            Exam::create([
                'code' => trim($r->XKodeUjian) ?: 'UJIAN',
                'name' => trim($r->XKodeUjian . ' ' . $bank->code),
                'question_bank_id' => $bank->id,
                'academic_year_id' => $years[trim($r->XSetId)] ?? null,
                'grade_id' => $grades[trim($r->XKodeKelas)] ?? null,
                'grade_level_id' => $bank->grade_level_id,
                'major_id' => $majors[trim($r->XKodeJurusan)]['major_id'] ?? null,
                'exam_format_id' => $bank->exam_format_id,
                'session_no' => ($sesi === '' || strtoupper($sesi) === 'ALL') ? null : (int) $sesi,
                'exam_date' => $r->XTglUjian ?: today(),
                'start_time' => $r->XJamUjian ?: '07:00:00',
                'late_limit_time' => $r->XBatasMasuk ?: '09:00:00',
                'duration_minutes' => $duration,
                'late_policy' => $r->XLambat === '1' ? 'reduced' : 'full',
                'token' => strtoupper(trim($r->XTokenUjian)) ?: Exam::generateToken(),
                'show_token' => $r->XStatusToken === '1',
                'shuffle_questions' => ($r->XAcakSoal ?? 'Y') !== 'N',
                'shuffle_options' => true,
                'mc_count' => (int) $r->XPilGanda,
                'essay_count' => (int) $r->XEsai,
                'mc_weight_percent' => 100,
                'essay_weight_percent' => 0,
                'status' => $status,
                'proctor_name' => trim($r->XProktor) ?: null,
                'supervisor_name' => trim($r->XPengawas) ?: null,
                'notes' => trim($r->XCatatan) ?: null,
            ]);
            $n++;
        }
        $this->stats['exams'] = $n;
    }

    private function importUsers($legacy): void
    {
        $n = 0;
        foreach ($legacy->table('cbt_user')->get() as $r) {
            $username = trim($r->Username);
            if ($username === '') {
                continue;
            }
            $email = filter_var($r->Email, FILTER_VALIDATE_EMAIL) ? $r->Email : "$username@unbk.local";
            if (User::where('email', $email)->exists()) {
                continue;
            }
            // password lama MD5 tidak bisa dikonversi: pakai password default, wajib diganti
            User::create([
                'name' => trim($r->Nama) ?: $username,
                'email' => $email,
                'password' => Hash::make('password'),
                'role' => (int) $r->login === 2 ? 'guru' : 'admin',
                'is_active' => $r->Status === '1',
            ]);
            $n++;
        }
        $this->stats['users (password: "password")'] = $n;
    }

    /**
     * Salin file media lama ke storage/app/public/<dir>/, kembalikan path relatif atau null.
     */
    private function copyMedia(string $relative, string $dir): ?string
    {
        $file = trim(basename($relative));
        if ($file === '' || $file === '.' || !$this->option('media')) {
            return null;
        }
        $src = rtrim($this->option('media'), '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
        if (!File::isFile($src)) {
            return null;
        }
        $safe = Str::slug(pathinfo($file, PATHINFO_FILENAME)) . '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $dest = storage_path('app/public/' . $dir . '/' . $safe);
        if (!File::exists($dest)) {
            File::ensureDirectoryExists(dirname($dest));
            File::copy($src, $dest);
        }

        return $dir . '/' . $safe;
    }

    private function cleanHtml(?string $html): string
    {
        $html = (string) $html;
        // path gambar inline lama -> storage publik
        $html = preg_replace_callback('/src=["\']([^"\']*pictures\/)?([^"\'\/]+\.(?:png|jpe?g|gif))["\']/i', function ($m) {
            $path = $this->copyMedia('pictures/' . $m[2], 'questions');

            return 'src="' . ($path ? asset('storage/' . $path) : $m[2]) . '"';
        }, $html);
        // buang font-size hardcoded dari TinyMCE lama agar mengikuti tema baru
        $html = preg_replace('/\s*style="[^"]*font-size:[^"]*"/i', '', $html);

        return trim($html);
    }
}
