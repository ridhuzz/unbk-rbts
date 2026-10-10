import { Button } from '@/components/tremor/Button';
import { Callout } from '@/components/tremor/Callout';
import { Card } from '@/components/tremor/Card';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Textarea } from '@/components/tremor/Textarea';
import { AcademicSelect, academicValueFrom } from '@/components/unbk/academic-select';
import { Field, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type AcademicOptions, type ExamRow } from '@/types/unbk';
import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo } from 'react';

interface Bank {
    id: number;
    code: string;
    name: string;
    subject: string | null;
    mc_total: number;
    essay_total: number;
    grade_level_id: number | null;
    level_id: number | null;
    tingkat: string | null;
    exam_format_id: number | null;
    major_id: number | null;
}

interface Props extends AcademicOptions {
    exam: ExamRow | null;
    banks: Bank[];
    readiness?: string[];
}

export default function ExamForm(props: Props) {
    const { exam, banks, majors, academic_years, levels, grades, exam_formats, readiness = [] } = props;
    const initialAcademic = academicValueFrom(levels, exam?.grade_level_id ?? null, exam?.grade_id ?? null);
    const { data, setData, post, put, processing, errors } = useForm({
        code: exam?.code ?? 'TO',
        name: exam?.name ?? '',
        exam_format_id: exam?.exam_format_id ? String(exam.exam_format_id) : '',
        question_bank_id: exam?.question_bank_id ? String(exam.question_bank_id) : '',
        academic_year_id: exam?.academic_year_id ? String(exam.academic_year_id) : String(academic_years.find((y) => y.is_active)?.id ?? ''),
        level_id: initialAcademic.level_id,
        grade_level_id: initialAcademic.grade_level_id,
        grade_id: initialAcademic.grade_id,
        major_id: exam?.major_id ? String(exam.major_id) : '',
        session_no: exam?.session_no ? String(exam.session_no) : '',
        exam_date: exam?.exam_date ?? new Date().toISOString().slice(0, 10),
        start_time: exam?.start_time ?? '07:30',
        late_limit_time: exam?.late_limit_time ?? '09:00',
        duration_minutes: exam?.duration_minutes ?? 90,
        late_policy: exam?.late_policy ?? 'full',
        token: exam?.token ?? '',
        show_token: exam?.show_token ?? false,
        shuffle_questions: exam?.shuffle_questions ?? true,
        shuffle_options: exam?.shuffle_options ?? true,
        mc_count: exam?.mc_count ?? 0,
        essay_count: exam?.essay_count ?? 0,
        mc_weight_percent: exam?.mc_weight_percent ?? 100,
        essay_weight_percent: exam?.essay_weight_percent ?? 0,
        status: exam?.status ?? 'draft',
        proctor_name: exam?.proctor_name ?? '',
        supervisor_name: exam?.supervisor_name ?? '',
        notes: exam?.notes ?? '',
        instructions: exam?.instructions ?? '',
    });

    const bank = useMemo(() => banks.find((b) => String(b.id) === data.question_bank_id), [banks, data.question_bank_id]);

    // bank soal disaring berantai: format ujian -> tingkat
    const bankChoices = useMemo(
        () => banks.filter((b) => (!data.exam_format_id || String(b.exam_format_id) === data.exam_format_id) && (!data.grade_level_id || String(b.grade_level_id) === data.grade_level_id)),
        [banks, data.exam_format_id, data.grade_level_id],
    );

    const chooseBank = (id: string) => {
        const b = banks.find((x) => String(x.id) === id);
        const academic = b?.grade_level_id ? academicValueFrom(levels, b.grade_level_id, null) : null;
        setData((d) => ({
            ...d,
            question_bank_id: id,
            // target tingkat mengikuti bank bila belum dipilih
            level_id: d.grade_level_id ? d.level_id : (academic?.level_id ?? d.level_id),
            grade_level_id: d.grade_level_id || (academic?.grade_level_id ?? ''),
            exam_format_id: d.exam_format_id || (b?.exam_format_id ? String(b.exam_format_id) : ''),
            mc_count: b ? b.mc_total : d.mc_count,
            essay_count: b ? b.essay_total : d.essay_count,
            mc_weight_percent: b && b.essay_total === 0 ? 100 : d.mc_weight_percent,
            essay_weight_percent: b && b.essay_total === 0 ? 0 : d.essay_weight_percent,
            name: d.name || (b ? `${d.code} ${b.code}` : d.name),
        }));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (exam) put(route('admin.exams.update', exam.id));
        else post(route('admin.exams.store'));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Jadwal Ujian', href: '/admin/exams' },
        { title: exam ? 'Edit jadwal' : 'Jadwal baru', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={exam ? 'Edit jadwal ujian' : 'Jadwal ujian baru'} />
            <PageHeader title={exam ? 'Edit jadwal ujian' : 'Jadwal ujian baru'} description="Pilih bank soal, tentukan peserta, waktu, dan aturan penilaian." />
            <form onSubmit={submit} className="grid max-w-4xl gap-6">
                {exam && exam.attempts_count > 0 && (
                    <Callout variant="warning" title="Sudah ada peserta yang mengerjakan">
                        {exam.attempts_count} peserta sudah mulai. Perubahan jumlah soal dan bank soal hanya berlaku untuk peserta yang belum mulai.
                    </Callout>
                )}
                {exam && readiness.length > 0 && (
                    <Callout variant="error" title="Jadwal belum siap diaktifkan">
                        <ul className="list-disc pl-5">
                            {readiness.map((r) => (
                                <li key={r}>{r}</li>
                            ))}
                        </ul>
                    </Callout>
                )}
                {exam && readiness.length === 0 && (
                    <Callout variant="success" title="Jadwal siap diaktifkan">
                        Bank soal lengkap, kunci jawaban valid, dan pengaturan waktu konsisten.
                    </Callout>
                )}

                <Section title="Format, bank soal & identitas">
                    <Field label="Format ujian" error={errors.exam_format_id} hint="Menyaring bank soal yang bisa dipilih">
                        <NativeSelect value={data.exam_format_id} onChange={(e) => setData((d) => ({ ...d, exam_format_id: e.target.value, question_bank_id: '' }))}>
                            <option value="">Semua format</option>
                            {exam_formats.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Bank soal" error={errors.question_bank_id} hint={`${bankChoices.length} bank tersedia untuk saringan ini`}>
                        <NativeSelect value={data.question_bank_id} onChange={(e) => chooseBank(e.target.value)} hasError={!!errors.question_bank_id}>
                            <option value="">Pilih bank soal…</option>
                            {bankChoices.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.tingkat ? `[${b.tingkat}] ` : ''}
                                    {b.code} · {b.subject} ({b.mc_total} PG, {b.essay_total} esai)
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Kode ujian" error={errors.code} hint="Mis. TO1, UTS, UAS">
                        <Input value={data.code} onChange={(e) => setData('code', e.target.value)} className="uppercase" />
                    </Field>
                    <Field label="Nama ujian" error={errors.name}>
                        <Input value={data.name} onChange={(e) => setData('name', e.target.value)} hasError={!!errors.name} />
                    </Field>
                    <Field label="Tahun ajaran" error={errors.academic_year_id}>
                        <NativeSelect value={data.academic_year_id} onChange={(e) => setData('academic_year_id', e.target.value)}>
                            <option value="">-</option>
                            {academic_years.map((y) => (
                                <option key={y.id} value={y.id}>
                                    {y.code}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                </Section>

                <Section title="Peserta yang boleh ikut" hint="Berantai: jenjang → tingkat → rombel. Kosongkan untuk semua.">
                    <div className="sm:col-span-2">
                        <AcademicSelect
                            levels={levels}
                            grades={grades}
                            withGrade
                            allowAllLevels
                            value={{ level_id: data.level_id, grade_level_id: data.grade_level_id, grade_id: data.grade_id }}
                            onChange={(v) => setData((d) => ({ ...d, ...v }))}
                            errors={{ grade_level_id: errors.grade_level_id, grade_id: errors.grade_id }}
                        />
                    </div>
                    <Field label="Peminatan" error={errors.major_id}>
                        <NativeSelect value={data.major_id} onChange={(e) => setData('major_id', e.target.value)}>
                            <option value="">Semua peminatan</option>
                            {majors.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.code}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field label="Sesi" error={errors.session_no}>
                        <Input type="number" min={1} placeholder="Semua sesi" value={data.session_no} onChange={(e) => setData('session_no', e.target.value)} />
                    </Field>
                </Section>

                <Section title="Waktu">
                    <Field label="Tanggal" error={errors.exam_date}>
                        <Input type="date" value={data.exam_date} onChange={(e) => setData('exam_date', e.target.value)} />
                    </Field>
                    <Field label="Jam mulai" error={errors.start_time}>
                        <Input type="time" value={data.start_time} onChange={(e) => setData('start_time', e.target.value)} />
                    </Field>
                    <Field label="Batas masuk" error={errors.late_limit_time} hint="Setelah jam ini peserta tidak bisa mulai">
                        <Input type="time" value={data.late_limit_time} onChange={(e) => setData('late_limit_time', e.target.value)} hasError={!!errors.late_limit_time} />
                    </Field>
                    <Field label="Durasi (menit)" error={errors.duration_minutes}>
                        <Input type="number" min={1} value={data.duration_minutes} onChange={(e) => setData('duration_minutes', Number(e.target.value))} />
                    </Field>
                    <Field label="Peserta terlambat" error={errors.late_policy} className="sm:col-span-2">
                        <NativeSelect value={data.late_policy} onChange={(e) => setData('late_policy', e.target.value as 'full' | 'reduced')}>
                            <option value="full">Tetap dapat durasi penuh sejak mulai mengerjakan</option>
                            <option value="reduced">Waktu dipotong sesuai keterlambatan dari jam mulai</option>
                        </NativeSelect>
                    </Field>
                </Section>

                <Section title="Soal & penilaian">
                    <Field label="Jumlah PG dipakai" error={errors.mc_count} hint={bank ? `tersedia ${bank.mc_total}` : undefined}>
                        <Input type="number" min={0} value={data.mc_count} onChange={(e) => setData('mc_count', Number(e.target.value))} hasError={!!errors.mc_count} />
                    </Field>
                    <Field label="Jumlah esai dipakai" error={errors.essay_count} hint={bank ? `tersedia ${bank.essay_total}` : undefined}>
                        <Input type="number" min={0} value={data.essay_count} onChange={(e) => setData('essay_count', Number(e.target.value))} />
                    </Field>
                    <Field label="Bobot PG (%)" error={errors.mc_weight_percent}>
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={data.mc_weight_percent}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                setData((d) => ({ ...d, mc_weight_percent: v, essay_weight_percent: 100 - v }));
                            }}
                        />
                    </Field>
                    <Field label="Bobot esai (%)" error={errors.essay_weight_percent}>
                        <Input type="number" value={data.essay_weight_percent} readOnly />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Checkbox checked={data.shuffle_questions} onCheckedChange={(v) => setData('shuffle_questions', v === true)} /> Acak urutan soal per peserta
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Checkbox checked={data.shuffle_options} onCheckedChange={(v) => setData('shuffle_options', v === true)} /> Acak urutan opsi jawaban
                    </label>
                </Section>

                <Section title="Token & petugas">
                    <Field label="Token" error={errors.token} hint="Kosongkan untuk dibuat otomatis">
                        <Input value={data.token} onChange={(e) => setData('token', e.target.value.toUpperCase())} maxLength={10} className="font-mono uppercase tracking-widest" />
                    </Field>
                    <label className="flex items-center gap-2 pt-7 text-sm text-gray-700 dark:text-gray-300">
                        <Checkbox checked={data.show_token} onCheckedChange={(v) => setData('show_token', v === true)} /> Tampilkan token di layar peserta
                    </label>
                    <Field label="Proktor" error={errors.proctor_name}>
                        <Input value={data.proctor_name} onChange={(e) => setData('proctor_name', e.target.value)} />
                    </Field>
                    <Field label="Pengawas" error={errors.supervisor_name}>
                        <Input value={data.supervisor_name} onChange={(e) => setData('supervisor_name', e.target.value)} />
                    </Field>
                    <Field label="Status" error={errors.status}>
                        <NativeSelect value={data.status} onChange={(e) => setData('status', e.target.value as ExamRow['status'])}>
                            <option value="draft">Draft (belum bisa diikuti)</option>
                            <option value="active">Aktif</option>
                            <option value="finished">Selesai</option>
                        </NativeSelect>
                    </Field>
                    <Field label="Petunjuk untuk peserta" error={errors.instructions} hint="Tampil di halaman konfirmasi sebelum peserta menekan Mulai. Kosongkan untuk petunjuk standar." className="sm:col-span-2">
                        <Textarea value={data.instructions} onChange={(e) => setData('instructions', e.target.value)} rows={4} />
                    </Field>
                    <Field label="Catatan internal" error={errors.notes} className="sm:col-span-2">
                        <Textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                    </Field>
                </Section>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" asChild>
                        <Link href={route('admin.exams.index')}>Batal</Link>
                    </Button>
                    <Button type="submit" isLoading={processing}>
                        {exam ? 'Simpan perubahan' : 'Buat jadwal'}
                    </Button>
                </div>
            </form>
        </AppLayout>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <Card>
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
        </Card>
    );
}
