<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AttemptAnswer;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamFormat;
use App\Models\Grade;
use App\Models\GradeLevel;
use App\Models\Question;
use App\Models\QuestionBank;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Services\ExamEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Pengujian alur ujian dari awal sampai akhir: akses, token, sesi, jawaban, penilaian, publikasi, siklus status, dan kontrol proktor.
 */
class ExamFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * Data minimal: 1 mapel, 1 bank (3 PG kunci A/B/C + 1 esai), 1 kelas, 1 siswa, 1 jadwal aktif hari ini.
     */
    private function makeExam(array $examOverrides = [], int $mc = 3, int $essay = 1): array
    {
        $subject = Subject::create(['code' => 'MTK', 'name' => 'Matematika']);
        $grade = Grade::create(['code' => 'XII.A', 'name' => '12A']);
        $bank = QuestionBank::create(['code' => 'MTK-T1', 'name' => 'Bank uji', 'subject_id' => $subject->id, 'option_count' => 4]);
        $keys = ['A', 'B', 'C'];
        for ($i = 1; $i <= $mc; $i++) {
            Question::create([
                'question_bank_id' => $bank->id, 'number' => $i, 'type' => Question::TYPE_MC, 'body' => "<p>Soal $i</p>",
                'options' => collect(['A', 'B', 'C', 'D'])->map(fn ($k) => ['key' => $k, 'body' => "Opsi $k", 'image' => null])->all(),
                'answer_key' => $keys[($i - 1) % 3],
            ]);
        }
        for ($i = 1; $i <= $essay; $i++) {
            Question::create(['question_bank_id' => $bank->id, 'number' => $mc + $i, 'type' => Question::TYPE_ESSAY, 'body' => '<p>Jelaskan!</p>']);
        }
        $student = Student::create(['exam_number' => 'S001', 'name' => 'Siswa Uji', 'password' => 'rahasia', 'grade_id' => $grade->id, 'session_no' => 1]);
        $exam = Exam::create(array_merge([
            'code' => 'TO', 'name' => 'Tryout 1', 'question_bank_id' => $bank->id, 'grade_id' => $grade->id,
            'exam_date' => today()->format('Y-m-d'), 'start_time' => '00:00:00', 'late_limit_time' => '23:59:00',
            'duration_minutes' => 60, 'token' => 'ABCDE', 'mc_count' => $mc, 'essay_count' => $essay,
            'mc_weight_percent' => $essay ? 70 : 100, 'essay_weight_percent' => $essay ? 30 : 0, 'status' => Exam::STATUS_ACTIVE,
        ], $examOverrides));

        return compact('subject', 'grade', 'bank', 'student', 'exam');
    }

    private function admin(string $role = 'admin'): User
    {
        return User::factory()->create(['role' => $role, 'is_active' => true]);
    }

    private function engine(): ExamEngine
    {
        return app(ExamEngine::class);
    }

    // ------------------------------------------------------------ akses

    public function test_peserta_tanpa_login_diarahkan_ke_login_peserta(): void
    {
        $this->get('/siswa/ujian')->assertRedirect('/siswa/login');
    }

    public function test_peserta_tidak_bisa_membuka_panel_admin(): void
    {
        ['student' => $student] = $this->makeExam();
        $this->actingAs($student, 'student')->get('/admin')->assertRedirect('/login');
    }

    public function test_proktor_tidak_bisa_membuat_jadwal_atau_menghitung_ulang_nilai(): void
    {
        ['exam' => $exam] = $this->makeExam();
        $this->actingAs($this->admin('proktor'))->get('/admin/exams/create')->assertForbidden();
        $this->actingAs($this->admin('proktor'))->post("/admin/exams/{$exam->id}/results/regrade")->assertForbidden();
    }

    public function test_peserta_lain_tidak_bisa_melihat_halaman_selesai_milik_orang_lain(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        $other = Student::create(['exam_number' => 'S002', 'name' => 'Lain', 'password' => 'x', 'grade_id' => $student->grade_id]);
        $this->actingAs($other, 'student')->get("/siswa/ujian/selesai/{$attempt->id}")->assertForbidden();
    }

    // ------------------------------------------------------------ mulai & token

    public function test_token_salah_ditolak_dan_tidak_membuat_sesi(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $this->actingAs($student, 'student')->post('/siswa/ujian/mulai', ['exam_id' => $exam->id, 'token' => 'SALAH'])
            ->assertSessionHasErrors('token');
        $this->assertSame(0, ExamAttempt::count());
    }

    public function test_token_benar_membuat_sesi_dan_kunci_tidak_dikirim_ke_peserta(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $this->actingAs($student, 'student')->post('/siswa/ujian/mulai', ['exam_id' => $exam->id, 'token' => 'abcde'])
            ->assertRedirect('/siswa/ujian/kerjakan');

        $attempt = ExamAttempt::first();
        $this->assertSame(ExamAttempt::STATUS_IN_PROGRESS, $attempt->status);
        $this->assertSame(4, $attempt->answers()->count());
        $this->assertEquals(60, $attempt->started_at->diffInMinutes($attempt->ends_at));

        $page = $this->actingAs($student, 'student')->get('/siswa/ujian/kerjakan');
        $page->assertOk();
        $this->assertStringNotContainsString('answer_key', $page->getContent());
    }

    public function test_peserta_di_luar_kelas_target_tidak_bisa_mulai(): void
    {
        ['exam' => $exam] = $this->makeExam();
        $otherGrade = Grade::create(['code' => 'X.B', 'name' => '10B']);
        $outsider = Student::create(['exam_number' => 'S009', 'name' => 'Luar', 'password' => 'x', 'grade_id' => $otherGrade->id]);
        $this->actingAs($outsider, 'student')->post('/siswa/ujian/mulai', ['exam_id' => $exam->id, 'token' => 'ABCDE'])
            ->assertSessionHasErrors('exam_id');
        $this->assertSame(0, ExamAttempt::count());
    }

    public function test_ujian_di_luar_jam_masuk_tidak_bisa_dimulai(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam(['start_time' => '00:00:00', 'late_limit_time' => '00:01:00']);
        Carbon::setTestNow(today()->setTime(10, 0));
        $this->expectException(ValidationException::class);
        $this->engine()->start($exam, $student, '127.0.0.1');
    }

    public function test_memulai_ulang_tidak_membuat_sesi_baru_dan_tidak_mereset_waktu(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $first = $this->engine()->start($exam, $student, '127.0.0.1');
        Carbon::setTestNow(now()->addMinutes(10));
        $second = $this->engine()->start($exam, $student, '127.0.0.1');
        $this->assertSame($first->id, $second->id);
        $this->assertTrue($second->ends_at->equalTo($first->ends_at));
        $this->assertSame(1, ExamAttempt::count());
    }

    // ------------------------------------------------------------ jawaban & penilaian

    public function test_jawaban_tersimpan_dinilai_di_server_dan_ragu_ragu_bisa_ditandai(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        $row = $attempt->answers()->with('question')->get()->first(fn ($a) => $a->question->isMultipleChoice());

        $res = $this->engine()->answer($attempt, $row->question_id, $row->question->answer_key, null, true);
        $this->assertSame($row->question->answer_key, $res['answer']);
        $this->assertTrue($res['is_doubtful']);
        $this->assertTrue($row->fresh()->is_correct);

        $this->engine()->answer($attempt, $row->question_id, 'D', null, null);
        $this->assertFalse($row->fresh()->is_correct);
    }

    public function test_pilihan_di_luar_opsi_ditolak(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        $row = $attempt->answers()->with('question')->get()->first(fn ($a) => $a->question->isMultipleChoice());
        $this->expectException(ValidationException::class);
        $this->engine()->answer($attempt, $row->question_id, 'Z', null, null);
    }

    public function test_selesai_menghitung_nilai_idempoten_dan_menolak_jawaban_setelahnya(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $engine = $this->engine();
        $attempt = $engine->start($exam, $student, '127.0.0.1');
        $mcRows = $attempt->answers()->with('question')->get()->filter(fn ($a) => $a->question->isMultipleChoice())->values();
        $engine->answer($attempt, $mcRows[0]->question_id, $mcRows[0]->question->answer_key, null, null);
        $engine->answer($attempt, $mcRows[1]->question_id, $mcRows[1]->question->answer_key, null, null);
        $engine->answer($attempt, $mcRows[2]->question_id, $mcRows[2]->question->answer_key === 'A' ? 'B' : 'A', null, null);

        $done = $engine->finish($attempt);
        $this->assertSame(ExamAttempt::STATUS_FINISHED, $done->status);
        $this->assertSame(2, $done->correct_count);
        $this->assertSame(1, $done->wrong_count);
        $this->assertEquals(66.67, (float) $done->score_mc);
        $this->assertNull($done->score_essay);

        $finishedAt = $done->finished_at;
        $again = $engine->finish($done->fresh());
        $this->assertTrue($again->finished_at->equalTo($finishedAt));

        $this->expectException(ValidationException::class);
        $engine->answer($done->fresh(), $mcRows[0]->question_id, 'A', null, null);
    }

    public function test_waktu_habis_menutup_sesi_otomatis_saat_diakses(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam(['duration_minutes' => 5]);
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        Carbon::setTestNow(now()->addMinutes(6));
        $this->actingAs($student, 'student')->withSession(['attempt_token' => $attempt->session_token])
            ->getJson('/siswa/ujian/status')->assertOk()->assertJsonPath('status', 'finished')
            ->assertJsonPath('redirect', route('siswa.ujian.selesai', $attempt));
        $this->assertSame(ExamAttempt::STATUS_FINISHED, $attempt->fresh()->status);
        // jawaban setelah waktu habis ditolak
        $this->actingAs($student, 'student')->withSession(['attempt_token' => $attempt->session_token])
            ->postJson('/siswa/ujian/jawab', ['question_id' => $attempt->answers()->first()->question_id, 'answer' => 'A'])->assertStatus(409);
    }

    public function test_sesi_dari_perangkat_lain_diputus_dan_diarahkan_ke_login(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        $this->actingAs($student, 'student')->withSession(['attempt_token' => 'token-lama'])
            ->get('/siswa/ujian/kerjakan')->assertRedirect('/siswa/login')->assertSessionHas('error');
        $this->assertSame(ExamAttempt::STATUS_IN_PROGRESS, $attempt->fresh()->status);
    }

    public function test_nilai_esai_berbobot_dan_hasil_hanya_tampil_setelah_dipublikasikan(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $engine = $this->engine();
        $attempt = $engine->start($exam, $student, '127.0.0.1');
        $rows = $attempt->answers()->with('question')->get();
        foreach ($rows->filter(fn ($a) => $a->question->isMultipleChoice()) as $r) {
            $engine->answer($attempt, $r->question_id, $r->question->answer_key, null, null);
        }
        $essayRow = $rows->first(fn ($a) => $a->question->isEssay());
        $engine->answer($attempt, $essayRow->question_id, null, 'Jawaban saya', null);
        $engine->finish($attempt);

        $guru = $this->admin('guru');
        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/results/publish", ['published' => true])->assertSessionHas('error');

        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/grade-essay", ['scores' => [$essayRow->id => 80]])
            ->assertSessionHas('success');
        $attempt->refresh();
        $this->assertEquals(100.0, (float) $attempt->score_mc);
        $this->assertEquals(80.0, (float) $attempt->score_essay);
        $this->assertEquals(94.0, (float) $attempt->total_score);

        $this->actingAs($student, 'student')->get("/siswa/ujian/selesai/{$attempt->id}")
            ->assertInertia(fn (Assert $page) => $page->where('attempt.published', false)->where('attempt.score', null));

        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/results/publish", ['published' => true])->assertSessionHas('success');
        $this->actingAs($student, 'student')->get("/siswa/ujian/selesai/{$attempt->id}")
            ->assertInertia(fn (Assert $page) => $page->where('attempt.published', true)->where('attempt.score', 94));

        // setelah dipublikasikan, nilai terkunci sampai publikasi ditarik
        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/grade-essay", ['scores' => [$essayRow->id => 10]])
            ->assertSessionHas('error');
        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/results/regrade")->assertSessionHas('error');
        $this->assertEquals(94.0, (float) $attempt->fresh()->total_score);

        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/results/publish", ['published' => false])->assertSessionHas('success');
        $this->actingAs($guru)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/grade-essay", ['scores' => [$essayRow->id => 10]])
            ->assertSessionHas('success');
        $this->assertEquals(73.0, (float) $attempt->fresh()->total_score); // 100*0.7 + 10*0.3
    }

    // ------------------------------------------------------------ siklus status jadwal

    public function test_jadwal_draft_tidak_bisa_diaktifkan_bila_bank_kurang_atau_kunci_tidak_lengkap(): void
    {
        ['exam' => $exam, 'bank' => $bank] = $this->makeExam(['status' => Exam::STATUS_DRAFT]);
        $exam->update(['mc_count' => 10]);
        $this->actingAs($this->admin())->post("/admin/exams/{$exam->id}/status", ['status' => 'active'])->assertSessionHas('error');
        $this->assertSame(Exam::STATUS_DRAFT, $exam->fresh()->status);

        $exam->update(['mc_count' => 3]);
        Question::where('question_bank_id', $bank->id)->where('number', 2)->update(['answer_key' => null]);
        $this->actingAs($this->admin())->post("/admin/exams/{$exam->id}/status", ['status' => 'active'])->assertSessionHas('error');

        Question::where('question_bank_id', $bank->id)->where('number', 2)->update(['answer_key' => 'B']);
        $this->actingAs($this->admin())->post("/admin/exams/{$exam->id}/status", ['status' => 'active'])->assertSessionHas('success');
        $this->assertSame(Exam::STATUS_ACTIVE, $exam->fresh()->status);
    }

    public function test_jadwal_yang_sudah_dikerjakan_tidak_bisa_kembali_ke_draft_atau_dihapus(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $this->engine()->start($exam, $student, '127.0.0.1');
        $this->actingAs($this->admin())->post("/admin/exams/{$exam->id}/status", ['status' => 'draft'])->assertSessionHas('error');
        $this->actingAs($this->admin())->delete("/admin/exams/{$exam->id}")->assertSessionHas('error');
        $this->assertNotNull(Exam::find($exam->id));
    }

    // ------------------------------------------------------------ struktur akademik berjenjang

    public function test_target_tingkat_menyaring_peserta_lintas_rombel(): void
    {
        ['exam' => $exam, 'student' => $student, 'grade' => $grade] = $this->makeExam();
        $gl12 = GradeLevel::where('number', 12)->first();
        $gl11 = GradeLevel::where('number', 11)->first();
        $grade->update(['grade_level_id' => $gl12->id]);
        $student->update(['grade_level_id' => $gl12->id]);
        // jadwal menyasar tingkat 12 tanpa rombel: siswa tingkat 12 dari rombel lain pun boleh ikut
        $exam->update(['grade_id' => null, 'grade_level_id' => $gl12->id]);
        $other = Student::create(['exam_number' => 'S012', 'name' => 'Tingkat 12 lain', 'password' => 'x', 'grade_level_id' => $gl12->id]);
        $younger = Student::create(['exam_number' => 'S011', 'name' => 'Tingkat 11', 'password' => 'x', 'grade_level_id' => $gl11->id]);

        $this->assertSame(1, Exam::forStudent($other)->count());
        $this->assertSame(0, Exam::forStudent($younger)->count());
        $this->assertEqualsCanonicalizing([$student->id, $other->id], $exam->eligibleStudents()->pluck('id')->all());
    }

    public function test_rombel_harus_satu_tingkat_dengan_peserta_dan_riwayat_tercatat(): void
    {
        ['grade' => $grade] = $this->makeExam();
        $gl12 = GradeLevel::where('number', 12)->first();
        $gl10 = GradeLevel::where('number', 10)->first();
        $grade->update(['grade_level_id' => $gl12->id]);
        $year = AcademicYear::create(['code' => '2026/2027', 'name' => 'TA 2026/2027', 'is_active' => true]);

        $payload = ['exam_number' => 'S100', 'name' => 'Baru', 'grade_level_id' => $gl10->id, 'grade_id' => $grade->id, 'session_no' => 1];
        $this->actingAs($this->admin())->post('/admin/students', $payload)->assertSessionHasErrors('grade_id');

        $payload['grade_level_id'] = $gl12->id;
        $this->actingAs($this->admin())->post('/admin/students', $payload)->assertSessionHas('success');
        $student = Student::where('exam_number', 'S100')->first();
        $this->assertSame(1, $student->enrollments()->count());
        $this->assertSame($year->id, $student->enrollments()->first()->academic_year_id);
    }

    public function test_naik_tingkat_membuat_riwayat_baru_dan_meluluskan_tingkat_12(): void
    {
        ['student' => $student, 'grade' => $grade] = $this->makeExam();
        $gl11 = GradeLevel::where('number', 11)->first();
        $gl12 = GradeLevel::where('number', 12)->first();
        $oldYear = AcademicYear::create(['code' => '2025/2026', 'name' => 'TA lama', 'is_active' => false]);
        $grade->update(['grade_level_id' => $gl11->id, 'academic_year_id' => $oldYear->id]);
        $student->update(['grade_level_id' => $gl11->id, 'academic_year_id' => $oldYear->id]);
        $student->syncEnrollment($oldYear->id);
        $senior = Student::create(['exam_number' => 'S200', 'name' => 'Kelas 12', 'password' => 'x', 'grade_level_id' => $gl12->id, 'grade_id' => $grade->id, 'academic_year_id' => $oldYear->id]);
        $senior->syncEnrollment($oldYear->id);
        $newYear = AcademicYear::create(['code' => '2026/2027', 'name' => 'TA baru', 'is_active' => true]);

        $this->actingAs($this->admin())->post('/admin/students/promote', ['grade_id' => $grade->id])->assertSessionHas('success');

        $student->refresh();
        $this->assertSame($gl12->id, $student->grade_level_id);
        $this->assertNull($student->grade_id);
        $this->assertSame(2, $student->enrollments()->count());
        $this->assertSame($gl11->id, $student->enrollments()->where('academic_year_id', $oldYear->id)->first()->grade_level_id);
        $this->assertSame($gl12->id, $student->enrollments()->where('academic_year_id', $newYear->id)->first()->grade_level_id);
        $this->assertFalse($senior->fresh()->is_active);
    }

    public function test_bank_soal_subtes_harus_sesuai_format(): void
    {
        $this->makeExam();
        $snbt = ExamFormat::where('code', 'SNBT-2026')->first();
        $us = ExamFormat::where('code', 'US')->first();
        $subtest = Subject::where('code', 'SNBT-PU')->first();
        $gl12 = GradeLevel::where('number', 12)->first();
        $base = ['code' => 'PU-1', 'name' => 'Penalaran Umum paket 1', 'subject_id' => $subtest->id, 'grade_level_id' => $gl12->id, 'option_count' => 5];

        $this->actingAs($this->admin())->post('/admin/banks', $base + ['exam_format_id' => $us->id])->assertSessionHasErrors('subject_id');
        $this->actingAs($this->admin())->post('/admin/banks', $base + ['exam_format_id' => $snbt->id])->assertSessionHas('success');
        $this->assertSame($gl12->id, QuestionBank::where('code', 'PU-1')->first()->grade_level_id);
    }

    public function test_monitor_proktor_bisa_menambah_waktu_memaksa_selesai_dan_mereset_sesi(): void
    {
        ['exam' => $exam, 'student' => $student] = $this->makeExam();
        $attempt = $this->engine()->start($exam, $student, '127.0.0.1');
        $proktor = $this->admin('proktor');
        $endsAt = $attempt->ends_at;

        $this->actingAs($proktor)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/add-time", ['minutes' => 15])->assertSessionHas('success');
        $this->assertTrue($attempt->fresh()->ends_at->equalTo($endsAt->copy()->addMinutes(15)));

        $this->actingAs($proktor)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/force-finish")->assertSessionHas('success');
        $this->assertSame(ExamAttempt::STATUS_FORCE_FINISHED, $attempt->fresh()->status);

        $this->actingAs($proktor)->post("/admin/exams/{$exam->id}/attempts/{$attempt->id}/reset")->assertSessionHas('success');
        $this->assertNull(ExamAttempt::find($attempt->id));
        $this->assertSame(0, AttemptAnswer::count());
    }
}
