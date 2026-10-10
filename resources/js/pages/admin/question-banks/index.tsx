import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/tremor/Dialog';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Textarea } from '@/components/tremor/Textarea';
import { AcademicSelect, academicValueFrom, gradeNumberOf } from '@/components/unbk/academic-select';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty, Field, PageHeader } from '@/components/unbk/field';
import { Pagination } from '@/components/unbk/pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type AcademicOptions, type Paginated } from '@/types/unbk';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { RiAddLine, RiDeleteBinLine, RiFileList3Line, RiPencilLine } from '@remixicon/react';
import { useMemo, useState } from 'react';

export interface BankRow {
    id: number;
    code: string;
    name: string;
    subject: string | null;
    subject_id: number;
    subject_kind: 'school' | 'subtest' | null;
    level_id: number | null;
    grade_level_id: number | null;
    tingkat: string | null;
    major: string | null;
    major_id: number | null;
    curriculum_id: number | null;
    curriculum: string | null;
    exam_format_id: number | null;
    exam_format: string | null;
    academic_year_id: number | null;
    option_count: number;
    description: string | null;
    is_active: boolean;
    questions_count: number;
    exams_count: number;
}

interface Props extends AcademicOptions {
    banks: Paginated<BankRow>;
    filters: { q?: string; subject_id?: string; grade_level_id?: string; exam_format_id?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin' },
    { title: 'Bank Soal', href: '/admin/banks' },
];

export default function Banks(props: Props) {
    const { banks, filters } = props;
    const [editing, setEditing] = useState<BankRow | null | 'new'>(null);
    const [q, setQ] = useState(filters.q ?? '');
    const allGradeLevels = props.levels.flatMap((l) => l.grade_levels.map((g) => ({ ...g, level: l.code })));

    const applyFilter = (extra: Record<string, string> = {}) =>
        router.get(route('admin.banks.index'), { q, subject_id: filters.subject_id ?? '', grade_level_id: filters.grade_level_id ?? '', exam_format_id: filters.exam_format_id ?? '', ...extra }, { preserveState: true, replace: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bank Soal" />
            <PageHeader title="Bank soal" description="Kumpulan soal per mata uji dan tingkat; dipakai oleh jadwal ujian.">
                <Button onClick={() => setEditing('new')}>
                    <RiAddLine className="-ml-1 size-4" /> Bank soal baru
                </Button>
            </PageHeader>

            <form
                className="mb-4 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    applyFilter();
                }}
            >
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / nama" className="w-56" />
                <NativeSelect className="w-48" value={filters.exam_format_id ?? ''} onChange={(e) => applyFilter({ exam_format_id: e.target.value })}>
                    <option value="">Semua format</option>
                    {props.exam_formats.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.name}
                        </option>
                    ))}
                </NativeSelect>
                <NativeSelect className="w-40" value={filters.grade_level_id ?? ''} onChange={(e) => applyFilter({ grade_level_id: e.target.value })}>
                    <option value="">Semua tingkat</option>
                    {allGradeLevels.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.level} · {g.name}
                        </option>
                    ))}
                </NativeSelect>
                <NativeSelect className="w-48" value={filters.subject_id ?? ''} onChange={(e) => applyFilter({ subject_id: e.target.value })}>
                    <option value="">Semua mata uji</option>
                    {props.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </NativeSelect>
                <Button type="submit" variant="secondary">
                    Cari
                </Button>
            </form>

            <TableRoot className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#090E1A]">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell>Kode</TableHeaderCell>
                            <TableHeaderCell>Nama</TableHeaderCell>
                            <TableHeaderCell>Mata uji</TableHeaderCell>
                            <TableHeaderCell>Tingkat</TableHeaderCell>
                            <TableHeaderCell>Format / kurikulum</TableHeaderCell>
                            <TableHeaderCell className="text-right">Soal</TableHeaderCell>
                            <TableHeaderCell className="text-right">Dipakai</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {banks.data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Empty>Belum ada bank soal.</Empty>
                                </TableCell>
                            </TableRow>
                        )}
                        {banks.data.map((b) => (
                            <TableRow key={b.id}>
                                <TableCell className="font-mono">
                                    <Link href={route('admin.banks.show', b.id)} className="font-medium text-blue-600 hover:underline">
                                        {b.code}
                                    </Link>
                                </TableCell>
                                <TableCell>{b.name}</TableCell>
                                <TableCell>
                                    {b.subject}
                                    {b.major && <span className="text-xs text-gray-500"> · {b.major}</span>}
                                </TableCell>
                                <TableCell>{b.tingkat ?? <span className="text-amber-600">belum diisi</span>}</TableCell>
                                <TableCell className="text-xs">
                                    {b.exam_format ?? '-'}
                                    {b.curriculum && <div className="text-gray-500">{b.curriculum}</div>}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{b.questions_count}</TableCell>
                                <TableCell className="text-right tabular-nums">{b.exams_count}×</TableCell>
                                <TableCell>
                                    <Badge variant={b.is_active ? 'success' : 'neutral'}>{b.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    <Button variant="secondary" className="px-2 py-1" asChild>
                                        <Link href={route('admin.banks.show', b.id)}>
                                            <RiFileList3Line className="-ml-0.5 size-4" /> Soal
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" className="ml-1 p-1.5" onClick={() => setEditing(b)} title="Edit">
                                        <RiPencilLine className="size-4" />
                                    </Button>
                                    <ConfirmDialog
                                        trigger={
                                            <Button variant="ghost" className="p-1.5 text-red-600" title="Hapus">
                                                <RiDeleteBinLine className="size-4" />
                                            </Button>
                                        }
                                        title={`Hapus bank soal ${b.code}?`}
                                        description={`${b.questions_count} soal di dalamnya ikut terhapus. Bank yang sudah dipakai jadwal tidak bisa dihapus.`}
                                        destructive
                                        confirmLabel="Hapus"
                                        onConfirm={() => router.delete(route('admin.banks.destroy', b.id), { preserveScroll: true })}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination paginator={banks} />
            </TableRoot>

            {editing && <BankForm row={editing === 'new' ? null : editing} options={props} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

export function BankForm({ row, options, onClose }: { row: BankRow | null; options: AcademicOptions; onClose: () => void }) {
    const initialAcademic = academicValueFrom(options.levels, row?.grade_level_id ?? null, null);
    const defaultFormat = options.exam_formats.find((f) => f.code === 'US') ?? options.exam_formats[0];
    const { data, setData, post, put, processing, errors } = useForm({
        code: row?.code ?? '',
        name: row?.name ?? '',
        exam_format_id: row?.exam_format_id ? String(row.exam_format_id) : String(defaultFormat?.id ?? ''),
        subject_id: row?.subject_id ? String(row.subject_id) : '',
        level_id: initialAcademic.level_id,
        grade_level_id: initialAcademic.grade_level_id,
        major_id: row?.major_id ? String(row.major_id) : '',
        curriculum_id: row?.curriculum_id ? String(row.curriculum_id) : '',
        academic_year_id: row?.academic_year_id ? String(row.academic_year_id) : String(options.academic_years.find((y) => y.is_active)?.id ?? ''),
        option_count: row?.option_count ?? 5,
        description: row?.description ?? '',
        is_active: row?.is_active ?? true,
    });
    const err = errors as Record<string, string | undefined>;

    // mata uji mengikuti format (subtes) atau tingkat (mapel sekolah dalam rentang)
    const format = options.exam_formats.find((f) => String(f.id) === data.exam_format_id);
    const subtests = options.subjects.filter((s) => s.kind === 'subtest' && String(s.exam_format_id) === data.exam_format_id);
    const gradeNumber = gradeNumberOf(options.levels, data.grade_level_id);
    const subjectChoices = useMemo(() => {
        if (subtests.length > 0) return subtests;
        return options.subjects.filter((s) => s.kind === 'school' && (!gradeNumber || ((s.min_grade ?? 1) <= gradeNumber && (s.max_grade ?? 12) >= gradeNumber)));
    }, [subtests, options.subjects, gradeNumber]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (row) put(route('admin.banks.update', row.id), opts);
        else post(route('admin.banks.store'), opts);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{row ? 'Edit bank soal' : 'Bank soal baru'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Kode" error={err.code} hint="Unik, mis. BINDO-12-TO1">
                                <Input value={data.code} onChange={(e) => setData('code', e.target.value)} className="uppercase" autoFocus hasError={!!err.code} />
                            </Field>
                            <Field label="Nama" error={err.name}>
                                <Input value={data.name} onChange={(e) => setData('name', e.target.value)} hasError={!!err.name} />
                            </Field>
                        </div>

                        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-50">Sasaran</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Format ujian" error={err.exam_format_id} hint={subtests.length ? 'Format ini punya subtes sendiri' : undefined}>
                                    <NativeSelect value={data.exam_format_id} onChange={(e) => setData((d) => ({ ...d, exam_format_id: e.target.value, subject_id: '' }))} hasError={!!err.exam_format_id}>
                                        <option value="">Pilih…</option>
                                        {options.exam_formats.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field label="Kurikulum acuan (opsional)" error={err.curriculum_id}>
                                    <NativeSelect value={data.curriculum_id} onChange={(e) => setData('curriculum_id', e.target.value)}>
                                        <option value="">-</option>
                                        {options.curricula.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                            </div>
                            <AcademicSelect
                                className="mt-4"
                                levels={options.levels}
                                value={{ level_id: data.level_id, grade_level_id: data.grade_level_id, grade_id: '' }}
                                onChange={(v) => setData((d) => ({ ...d, level_id: v.level_id, grade_level_id: v.grade_level_id, subject_id: subtests.length ? d.subject_id : '' }))}
                                errors={{ grade_level_id: err.grade_level_id }}
                            />
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <Field label={subtests.length ? `Subtes ${format?.name ?? ''}` : 'Mata pelajaran'} error={err.subject_id} hint={!subtests.length && !data.grade_level_id ? 'Pilih tingkat untuk menyaring mapel' : undefined}>
                                    <NativeSelect value={data.subject_id} onChange={(e) => setData('subject_id', e.target.value)} hasError={!!err.subject_id}>
                                        <option value="">Pilih…</option>
                                        {subjectChoices.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                                {s.is_elective ? ' (pilihan)' : ''}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field label="Peminatan (opsional)" error={err.major_id}>
                                    <NativeSelect value={data.major_id} onChange={(e) => setData('major_id', e.target.value)}>
                                        <option value="">Semua</option>
                                        {options.majors.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.code}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Jumlah opsi" error={err.option_count}>
                                <NativeSelect value={data.option_count} onChange={(e) => setData('option_count', Number(e.target.value))}>
                                    {[2, 3, 4, 5].map((n) => (
                                        <option key={n} value={n}>
                                            {n} (A–{String.fromCharCode(64 + n)})
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field label="Tahun ajaran" error={err.academic_year_id}>
                                <NativeSelect value={data.academic_year_id} onChange={(e) => setData('academic_year_id', e.target.value)}>
                                    <option value="">-</option>
                                    {options.academic_years.map((y) => (
                                        <option key={y.id} value={y.id}>
                                            {y.code}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field label="Keterangan" error={err.description} className="sm:col-span-2">
                                <Textarea value={data.description} onChange={(e) => setData('description', e.target.value)} />
                            </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Checkbox checked={data.is_active} onCheckedChange={(v) => setData('is_active', v === true)} />
                            Aktif (bisa dipilih saat membuat jadwal)
                        </label>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" isLoading={processing}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
