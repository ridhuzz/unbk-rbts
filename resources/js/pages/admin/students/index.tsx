import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/tremor/Dialog';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { AcademicSelect, academicValueFrom, gradeNumberOf } from '@/components/unbk/academic-select';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty, Field, PageHeader } from '@/components/unbk/field';
import { Pagination } from '@/components/unbk/pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type AcademicOptions, type Paginated } from '@/types/unbk';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { RiAddLine, RiArrowUpCircleLine, RiDeleteBinLine, RiEyeLine, RiKey2Line, RiPencilLine } from '@remixicon/react';
import { useMemo, useState } from 'react';

export interface StudentRow {
    id: number;
    exam_number: string;
    nisn: string | null;
    name: string;
    gender: 'L' | 'P' | null;
    level_id: number | null;
    grade_level_id: number | null;
    tingkat: string | null;
    grade: string | null;
    grade_id: number | null;
    major: string | null;
    major_id: number | null;
    curriculum_id: number | null;
    curriculum: string | null;
    academic_year_id: number | null;
    class_name: string | null;
    session_no: number;
    room: string | null;
    school_origin: string | null;
    school_type: string | null;
    elective_subject_ids: number[];
    is_active: boolean;
}

interface Props extends AcademicOptions {
    students: Paginated<StudentRow>;
    filters: { q?: string; grade_level_id?: string; grade_id?: string; major_id?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin' },
    { title: 'Peserta', href: '/admin/students' },
];

export default function Students(props: Props) {
    const { students, filters } = props;
    const [editing, setEditing] = useState<StudentRow | null | 'new'>(null);
    const [q, setQ] = useState(filters.q ?? '');
    const [promoteGrade, setPromoteGrade] = useState<string>('');
    const [promoteTarget, setPromoteTarget] = useState<string>('');

    const applyFilter = (extra: Record<string, string> = {}) =>
        router.get(route('admin.students.index'), { q, grade_level_id: filters.grade_level_id ?? '', grade_id: filters.grade_id ?? '', major_id: filters.major_id ?? '', ...extra }, { preserveState: true, replace: true });

    const allGradeLevels = props.levels.flatMap((l) => l.grade_levels.map((g) => ({ ...g, level: l.code })));
    const activeYear = props.academic_years.find((y) => y.is_active);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Peserta" />
            <PageHeader title="Peserta" description={`${students.total.toLocaleString('id-ID')} peserta terdaftar`}>
                <ConfirmDialog
                    trigger={
                        <Button variant="secondary">
                            <RiArrowUpCircleLine className="-ml-1 size-4" /> Naik tingkat
                        </Button>
                    }
                    title={`Naik tingkat ke tahun ajaran ${activeYear?.code ?? '(belum ada yang aktif)'}`}
                    description="Seluruh peserta di rombel asal dinaikkan satu tingkat. Riwayat tahun sebelumnya tetap tersimpan. Peserta tingkat 12 ditandai lulus (nonaktif)."
                    confirmLabel="Jalankan"
                    onConfirm={() => router.post(route('admin.students.promote'), { grade_id: promoteGrade || null, target_grade_id: promoteTarget || null }, { preserveScroll: true })}
                >
                    <div className="grid gap-3 text-sm">
                        <Field label="Rombel asal">
                            <NativeSelect value={promoteGrade} onChange={(e) => setPromoteGrade(e.target.value)}>
                                <option value="">Pilih rombel…</option>
                                {props.grades.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.code} · {g.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field label="Rombel tujuan (opsional)" hint="Kosongkan bila rombel baru diatur belakangan">
                            <NativeSelect value={promoteTarget} onChange={(e) => setPromoteTarget(e.target.value)}>
                                <option value="">-</option>
                                {props.grades.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.code} · {g.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                    </div>
                </ConfirmDialog>
                <Button onClick={() => setEditing('new')}>
                    <RiAddLine className="-ml-1 size-4" /> Tambah peserta
                </Button>
            </PageHeader>

            <form
                className="mb-4 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    applyFilter();
                }}
            >
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor / rombel / sekolah" className="w-64" />
                <NativeSelect className="w-40" value={filters.grade_level_id ?? ''} onChange={(e) => applyFilter({ grade_level_id: e.target.value, grade_id: '' })}>
                    <option value="">Semua tingkat</option>
                    {allGradeLevels.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.level} · {g.name}
                        </option>
                    ))}
                </NativeSelect>
                <NativeSelect className="w-44" value={filters.grade_id ?? ''} onChange={(e) => applyFilter({ grade_id: e.target.value })}>
                    <option value="">Semua rombel</option>
                    {props.grades
                        .filter((g) => !filters.grade_level_id || String(g.grade_level_id) === filters.grade_level_id)
                        .map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.code}
                            </option>
                        ))}
                </NativeSelect>
                <NativeSelect className="w-36" value={filters.major_id ?? ''} onChange={(e) => applyFilter({ major_id: e.target.value })}>
                    <option value="">Semua peminatan</option>
                    {props.majors.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.code}
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
                            <TableHeaderCell>Nomor</TableHeaderCell>
                            <TableHeaderCell>Nama</TableHeaderCell>
                            <TableHeaderCell>Tingkat</TableHeaderCell>
                            <TableHeaderCell>Rombel</TableHeaderCell>
                            <TableHeaderCell>Peminatan</TableHeaderCell>
                            <TableHeaderCell>Sekolah asal</TableHeaderCell>
                            <TableHeaderCell>Sesi</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {students.data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Empty>Tidak ada peserta.</Empty>
                                </TableCell>
                            </TableRow>
                        )}
                        {students.data.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-mono">{s.exam_number}</TableCell>
                                <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                                    <Link href={route('admin.students.show', s.id)} className="hover:underline">
                                        {s.name}
                                    </Link>
                                    <div className="text-xs font-normal text-gray-500">{s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : ''}</div>
                                </TableCell>
                                <TableCell>{s.tingkat ?? <span className="text-amber-600">belum diisi</span>}</TableCell>
                                <TableCell>
                                    {s.grade ?? '-'}
                                    {s.class_name && <div className="text-xs text-gray-500">{s.class_name}</div>}
                                </TableCell>
                                <TableCell>{s.major ?? '-'}</TableCell>
                                <TableCell className="text-xs">
                                    {s.school_origin ?? '-'}
                                    {s.school_type && <div className="text-gray-500 capitalize">{s.school_type}</div>}
                                </TableCell>
                                <TableCell>{s.session_no}</TableCell>
                                <TableCell>
                                    <Badge variant={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    <Button variant="ghost" className="p-1.5" asChild title="Riwayat & hasil">
                                        <Link href={route('admin.students.show', s.id)}>
                                            <RiEyeLine className="size-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" className="p-1.5" onClick={() => setEditing(s)} title="Edit">
                                        <RiPencilLine className="size-4" />
                                    </Button>
                                    <ConfirmDialog
                                        trigger={
                                            <Button variant="ghost" className="p-1.5" title="Reset password ke nomor peserta">
                                                <RiKey2Line className="size-4" />
                                            </Button>
                                        }
                                        title={`Reset password ${s.name}?`}
                                        description={`Password akan diganti menjadi nomor peserta: ${s.exam_number}`}
                                        confirmLabel="Reset"
                                        onConfirm={() => router.post(route('admin.students.reset-password', s.id), {}, { preserveScroll: true })}
                                    />
                                    <ConfirmDialog
                                        trigger={
                                            <Button variant="ghost" className="p-1.5 text-red-600" title="Hapus">
                                                <RiDeleteBinLine className="size-4" />
                                            </Button>
                                        }
                                        title={`Hapus ${s.name}?`}
                                        description="Riwayat ujian dan keanggotaan peserta ini ikut terhapus."
                                        destructive
                                        confirmLabel="Hapus"
                                        onConfirm={() => router.delete(route('admin.students.destroy', s.id), { preserveScroll: true })}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination paginator={students} />
            </TableRoot>

            {editing && <StudentForm row={editing === 'new' ? null : editing} options={props} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

export function StudentForm({ row, options, onClose }: { row: StudentRow | null; options: AcademicOptions; onClose: () => void }) {
    const activeYear = options.academic_years.find((y) => y.is_active);
    const initialAcademic = academicValueFrom(options.levels, row?.grade_level_id ?? null, row?.grade_id ?? null);
    const { data, setData, post, put, processing, errors } = useForm({
        exam_number: row?.exam_number ?? '',
        nisn: row?.nisn ?? '',
        name: row?.name ?? '',
        gender: row?.gender ?? '',
        password: '',
        level_id: initialAcademic.level_id,
        grade_level_id: initialAcademic.grade_level_id,
        grade_id: initialAcademic.grade_id,
        major_id: row?.major_id ? String(row.major_id) : '',
        curriculum_id: row?.curriculum_id ? String(row.curriculum_id) : '',
        academic_year_id: row?.academic_year_id ? String(row.academic_year_id) : String(activeYear?.id ?? ''),
        class_name: row?.class_name ?? '',
        session_no: row?.session_no ?? 1,
        room: row?.room ?? '',
        school_origin: row?.school_origin ?? '',
        school_type: row?.school_type ?? '',
        elective_subject_ids: (row?.elective_subject_ids ?? []).map(String),
        is_active: row?.is_active ?? true,
    });
    const err = errors as Record<string, string | undefined>;

    const gradeNumber = gradeNumberOf(options.levels, data.grade_level_id);
    const electives = useMemo(
        () => options.subjects.filter((s) => s.kind === 'school' && s.is_elective && (!gradeNumber || ((s.min_grade ?? 1) <= gradeNumber && (s.max_grade ?? 12) >= gradeNumber))),
        [options.subjects, gradeNumber],
    );
    const showMajor = !gradeNumber || gradeNumber >= 10;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (row) put(route('admin.students.update', row.id), opts);
        else post(route('admin.students.store'), opts);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{row ? 'Edit peserta' : 'Tambah peserta'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Nomor peserta (username)" error={err.exam_number}>
                                <Input value={data.exam_number} onChange={(e) => setData('exam_number', e.target.value)} autoFocus hasError={!!err.exam_number} />
                            </Field>
                            <Field label="NISN / NIK" error={err.nisn}>
                                <Input value={data.nisn} onChange={(e) => setData('nisn', e.target.value)} />
                            </Field>
                            <Field label="Nama" error={err.name} className="sm:col-span-2">
                                <Input value={data.name} onChange={(e) => setData('name', e.target.value)} hasError={!!err.name} />
                            </Field>
                            <Field label="Jenis kelamin" error={err.gender}>
                                <NativeSelect value={data.gender} onChange={(e) => setData('gender', e.target.value as 'L' | 'P' | '')}>
                                    <option value="">-</option>
                                    <option value="L">Laki-laki</option>
                                    <option value="P">Perempuan</option>
                                </NativeSelect>
                            </Field>
                            <Field label={row ? 'Password baru (kosongkan jika tetap)' : 'Password (kosong = nomor peserta)'} error={err.password}>
                                <Input type="text" value={data.password} onChange={(e) => setData('password', e.target.value)} />
                            </Field>
                        </div>

                        <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-50">Akademik tahun ajaran {activeYear?.code ?? ''}</p>
                            <AcademicSelect
                                levels={options.levels}
                                grades={options.grades}
                                withGrade
                                academicYearId={activeYear?.id ?? null}
                                value={{ level_id: data.level_id, grade_level_id: data.grade_level_id, grade_id: data.grade_id }}
                                onChange={(v) => setData((d) => ({ ...d, ...v, elective_subject_ids: v.grade_level_id === d.grade_level_id ? d.elective_subject_ids : [] }))}
                                errors={{ grade_level_id: err.grade_level_id, grade_id: err.grade_id }}
                            />
                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                {showMajor && (
                                    <Field label="Peminatan" error={err.major_id} hint="Opsional (IPA/IPS)">
                                        <NativeSelect value={data.major_id} onChange={(e) => setData('major_id', e.target.value)}>
                                            <option value="">-</option>
                                            {options.majors.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.code}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                )}
                                <Field label="Kurikulum di sekolah" error={err.curriculum_id}>
                                    <NativeSelect value={data.curriculum_id} onChange={(e) => setData('curriculum_id', e.target.value)}>
                                        <option value="">-</option>
                                        {options.curricula.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field label="Sesi ujian" error={err.session_no}>
                                    <Input type="number" min={1} max={20} value={data.session_no} onChange={(e) => setData('session_no', Number(e.target.value))} />
                                </Field>
                            </div>
                            {electives.length > 0 && (
                                <div className="mt-4">
                                    <p className="mb-1.5 text-sm text-gray-700 dark:text-gray-300">Mapel pilihan</p>
                                    <div className="flex flex-wrap gap-3">
                                        {electives.map((s) => {
                                            const checked = data.elective_subject_ids.includes(String(s.id));
                                            return (
                                                <label key={s.id} className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(v) =>
                                                            setData('elective_subject_ids', v === true ? [...data.elective_subject_ids, String(s.id)] : data.elective_subject_ids.filter((x) => x !== String(s.id)))
                                                        }
                                                    />
                                                    {s.name}
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {err.elective_subject_ids && <p className="mt-1 text-xs text-red-600">{err.elective_subject_ids}</p>}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Sekolah asal" error={err.school_origin} className="sm:col-span-2">
                                <Input value={data.school_origin} onChange={(e) => setData('school_origin', e.target.value)} placeholder="Nama sekolah" />
                            </Field>
                            <Field label="Jenis sekolah" error={err.school_type}>
                                <NativeSelect value={data.school_type} onChange={(e) => setData('school_type', e.target.value)}>
                                    <option value="">-</option>
                                    <option value="negeri">Negeri</option>
                                    <option value="swasta">Swasta</option>
                                    <option value="internasional">Internasional</option>
                                </NativeSelect>
                            </Field>
                            <Field label="Ruang" error={err.room}>
                                <Input value={data.room} onChange={(e) => setData('room', e.target.value)} />
                            </Field>
                            <Field label="Nama rombel bebas (opsional)" error={err.class_name} className="sm:col-span-2">
                                <Input value={data.class_name} onChange={(e) => setData('class_name', e.target.value)} placeholder="Terisi otomatis dari rombel" />
                            </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Checkbox checked={data.is_active} onCheckedChange={(v) => setData('is_active', v === true)} />
                            Aktif (bisa login)
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
