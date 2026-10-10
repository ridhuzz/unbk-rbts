import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/tremor/Dialog';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Tabs, TabsList, TabsTrigger } from '@/components/tremor/Tabs';
import { AcademicSelect, academicValueFrom } from '@/components/unbk/academic-select';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty, Field, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type LevelOpt, type Option } from '@/types/unbk';
import { Head, router, useForm } from '@inertiajs/react';
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { useState } from 'react';

interface YearRow extends Option {
    name: string;
    is_active: boolean;
}
interface MajorRow extends Option {
    name: string;
    is_active: boolean;
}
interface GradeRow {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    grade_level_id: number | null;
    level_id: number | null;
    tingkat: string | null;
    academic_year_id: number | null;
    academic_year: string | null;
    major_id: number | null;
    major: string | null;
    students_count: number;
}
interface SubjectRow {
    id: number;
    code: string;
    name: string;
    kind: 'school' | 'subtest';
    is_active: boolean;
    exam_format_id: number | null;
    exam_format: string | null;
    min_grade: number | null;
    max_grade: number | null;
    is_elective: boolean;
}
interface CurriculumRow {
    id: number;
    name: string;
    year_label: string | null;
    is_active: boolean;
}
interface FormatRow {
    id: number;
    code: string;
    name: string;
    year_label: string | null;
    is_active: boolean;
    subtests_count: number;
}

interface Props {
    levels: LevelOpt[];
    academic_years: YearRow[];
    majors: MajorRow[];
    grades: GradeRow[];
    subjects: SubjectRow[];
    curricula: CurriculumRow[];
    exam_formats: FormatRow[];
}

type Tab = 'levels' | 'grades' | 'majors' | 'subjects' | 'curricula' | 'exam-formats' | 'academic-years';
type EditTarget = { type: Exclude<Tab, 'levels'>; row: Record<string, unknown> | null };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin' },
    { title: 'Data Master', href: '/admin/masters' },
];

const tabs: { key: Tab; label: string; hint: string }[] = [
    { key: 'levels', label: 'Jenjang & tingkat', hint: 'Skala kanonik 1–12. Semua data lain menempel ke tingkat ini.' },
    { key: 'grades', label: 'Rombel', hint: 'Kelompok belajar per tahun ajaran, menempel pada satu tingkat.' },
    { key: 'majors', label: 'Peminatan', hint: 'IPA, IPS, Bahasa. Opsional, untuk siswa kurikulum lama.' },
    { key: 'subjects', label: 'Mata uji', hint: 'Mata pelajaran sekolah (berlaku untuk rentang tingkat) atau subtes format ujian.' },
    { key: 'curricula', label: 'Kurikulum', hint: 'Nama dan tahun berlaku sebagai teks bebas, dicatat di riwayat siswa dan bank soal.' },
    { key: 'exam-formats', label: 'Format ujian', hint: 'UTBK-SNBT berversi tahun, Ujian Sekolah, IGCSE, dst.' },
    { key: 'academic-years', label: 'Tahun ajaran', hint: 'Hanya satu yang aktif; dipakai rombel dan riwayat siswa.' },
];

const activeBadge = (v: boolean) => <Badge variant={v ? 'success' : 'neutral'}>{v ? 'Aktif' : 'Nonaktif'}</Badge>;
const tableCls = 'mt-4 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#090E1A]';

export default function Masters(props: Props) {
    const [tab, setTab] = useState<Tab>('grades');
    const [editing, setEditing] = useState<EditTarget | null>(null);
    const current = tabs.find((t) => t.key === tab)!;

    const actions = (type: EditTarget['type'], row: Record<string, unknown>, label: string) => (
        <TableCell className="text-right whitespace-nowrap">
            <Button variant="ghost" className="p-1.5" onClick={() => setEditing({ type, row })} title="Edit">
                <RiPencilLine className="size-4" />
            </Button>
            <ConfirmDialog
                trigger={
                    <Button variant="ghost" className="p-1.5 text-red-600" title="Hapus">
                        <RiDeleteBinLine className="size-4" />
                    </Button>
                }
                title={`Hapus ${label}?`}
                description="Data yang masih dipakai peserta, bank soal, atau jadwal tidak bisa dihapus."
                destructive
                confirmLabel="Hapus"
                onConfirm={() => router.delete(route('admin.masters.destroy', [type, row.id as number]), { preserveScroll: true })}
            />
        </TableCell>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Data Master" />
            <PageHeader title="Data master akademik" description="Jenjang → tingkat → rombel, peminatan, mata uji, kurikulum, format ujian, tahun ajaran.">
                {tab !== 'levels' && (
                    <Button onClick={() => setEditing({ type: tab, row: null })}>
                        <RiAddLine className="-ml-1 size-4" /> Tambah {current.label.toLowerCase()}
                    </Button>
                )}
            </PageHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList>
                    {tabs.map((t) => (
                        <TabsTrigger key={t.key} value={t.key}>
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <p className="mt-3 text-sm text-gray-500">{current.hint}</p>

            {tab === 'levels' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {props.levels.map((l) => (
                        <Card key={l.id} className="p-4">
                            <div className="font-semibold text-gray-900 dark:text-gray-50">
                                {l.code} <span className="font-normal text-gray-500">· {l.name}</span>
                            </div>
                            <ul className="mt-3 space-y-1 text-sm">
                                {l.grade_levels.map((g) => (
                                    <li key={g.id} className="flex justify-between border-b border-gray-100 py-1 last:border-0 dark:border-gray-800">
                                        <span>{g.name}</span>
                                        <span className="text-gray-500">{g.intl_label}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    ))}
                </div>
            )}

            {tab === 'grades' && (
                <TableRoot className={tableCls}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeaderCell>Kode</TableHeaderCell>
                                <TableHeaderCell>Nama</TableHeaderCell>
                                <TableHeaderCell>Tingkat</TableHeaderCell>
                                <TableHeaderCell>Peminatan</TableHeaderCell>
                                <TableHeaderCell>Tahun ajaran</TableHeaderCell>
                                <TableHeaderCell className="text-right">Siswa</TableHeaderCell>
                                <TableHeaderCell>Status</TableHeaderCell>
                                <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {props.grades.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Empty>Belum ada rombel.</Empty>
                                    </TableCell>
                                </TableRow>
                            )}
                            {props.grades.map((g) => (
                                <TableRow key={g.id}>
                                    <TableCell className="font-mono text-gray-900 dark:text-gray-50">{g.code}</TableCell>
                                    <TableCell>{g.name}</TableCell>
                                    <TableCell>{g.tingkat ?? <span className="text-amber-600">belum diisi</span>}</TableCell>
                                    <TableCell>{g.major ?? '-'}</TableCell>
                                    <TableCell>{g.academic_year ?? '-'}</TableCell>
                                    <TableCell className="text-right tabular-nums">{g.students_count}</TableCell>
                                    <TableCell>{activeBadge(g.is_active)}</TableCell>
                                    {actions('grades', g as unknown as Record<string, unknown>, g.code)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableRoot>
            )}

            {tab === 'majors' && (
                <SimpleTable rows={props.majors} columns={['Kode', 'Nama']} render={(m) => [<span className="font-mono">{m.code}</span>, m.name]} actions={(m) => actions('majors', m as unknown as Record<string, unknown>, m.code)} empty="Belum ada peminatan." />
            )}

            {tab === 'subjects' && (
                <TableRoot className={tableCls}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeaderCell>Kode</TableHeaderCell>
                                <TableHeaderCell>Nama</TableHeaderCell>
                                <TableHeaderCell>Jenis</TableHeaderCell>
                                <TableHeaderCell>Format / rentang tingkat</TableHeaderCell>
                                <TableHeaderCell>Status</TableHeaderCell>
                                <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {props.subjects.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-mono text-gray-900 dark:text-gray-50">{s.code}</TableCell>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                        {s.kind === 'subtest' ? <Badge variant="default">Subtes</Badge> : <Badge variant="neutral">Mapel sekolah</Badge>}
                                        {s.is_elective && (
                                            <Badge variant="warning" className="ml-1">
                                                pilihan
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {s.kind === 'subtest'
                                            ? (s.exam_format ?? '-')
                                            : s.min_grade || s.max_grade
                                              ? `Tingkat ${s.min_grade ?? 1}–${s.max_grade ?? 12}`
                                              : 'Semua tingkat'}
                                    </TableCell>
                                    <TableCell>{activeBadge(s.is_active)}</TableCell>
                                    {actions('subjects', s as unknown as Record<string, unknown>, s.code)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableRoot>
            )}

            {tab === 'curricula' && (
                <SimpleTable
                    rows={props.curricula}
                    columns={['Nama', 'Tahun berlaku']}
                    render={(c) => [c.name, c.year_label ?? '-']}
                    actions={(c) => actions('curricula', c as unknown as Record<string, unknown>, c.name)}
                    empty="Belum ada kurikulum."
                />
            )}

            {tab === 'exam-formats' && (
                <SimpleTable
                    rows={props.exam_formats}
                    columns={['Kode', 'Nama', 'Tahun', 'Subtes']}
                    render={(f) => [<span className="font-mono">{f.code}</span>, f.name, f.year_label ?? '-', String(f.subtests_count)]}
                    actions={(f) => actions('exam-formats', f as unknown as Record<string, unknown>, f.name)}
                    empty="Belum ada format ujian."
                />
            )}

            {tab === 'academic-years' && (
                <SimpleTable
                    rows={props.academic_years}
                    columns={['Kode', 'Nama']}
                    render={(y) => [<span className="font-mono">{y.code}</span>, y.name]}
                    actions={(y) => actions('academic-years', y as unknown as Record<string, unknown>, y.code)}
                    empty="Belum ada tahun ajaran."
                />
            )}

            {editing && <MasterForm target={editing} props={props} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function SimpleTable<T extends { id: number; is_active: boolean }>({ rows, columns, render, actions, empty }: { rows: T[]; columns: string[]; render: (r: T) => React.ReactNode[]; actions: (r: T) => React.ReactNode; empty: string }) {
    return (
        <TableRoot className={tableCls}>
            <Table>
                <TableHead>
                    <TableRow>
                        {columns.map((c) => (
                            <TableHeaderCell key={c}>{c}</TableHeaderCell>
                        ))}
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={columns.length + 2}>
                                <Empty>{empty}</Empty>
                            </TableCell>
                        </TableRow>
                    )}
                    {rows.map((r) => (
                        <TableRow key={r.id}>
                            {render(r).map((cell, i) => (
                                <TableCell key={i} className={i === 0 ? 'text-gray-900 dark:text-gray-50' : ''}>
                                    {cell}
                                </TableCell>
                            ))}
                            <TableCell>{activeBadge(r.is_active)}</TableCell>
                            {actions(r)}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableRoot>
    );
}

function MasterForm({ target, props, onClose }: { target: EditTarget; props: Props; onClose: () => void }) {
    const { type, row } = target;
    const r = (row ?? {}) as Record<string, string | number | boolean | null | undefined>;
    const str = (k: string) => (r[k] === null || r[k] === undefined ? '' : String(r[k]));
    const label = tabs.find((t) => t.key === type)!.label.toLowerCase();

    const { data, setData, post, put, processing, errors } = useForm<Record<string, string | number | boolean>>({
        code: str('code'),
        name: str('name'),
        year_label: str('year_label'),
        is_active: row ? r.is_active !== false : true,
        // rombel
        level_id: academicValueFrom(props.levels, r.grade_level_id as number | null, null).level_id,
        grade_level_id: str('grade_level_id'),
        academic_year_id: str('academic_year_id') || String(props.academic_years.find((y) => y.is_active)?.id ?? ''),
        major_id: str('major_id'),
        // mata uji
        kind: str('kind') || 'school',
        exam_format_id: str('exam_format_id'),
        min_grade: str('min_grade'),
        max_grade: str('max_grade'),
        is_elective: r.is_elective === true,
    });
    const err = errors as Record<string, string | undefined>;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (row) put(route('admin.masters.update', [type, r.id as number]), opts);
        else post(route('admin.masters.store', type), opts);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>
                            {row ? 'Edit' : 'Tambah'} {label}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 grid gap-4">
                        {type !== 'curricula' && (
                            <Field label="Kode" error={err.code}>
                                <Input value={String(data.code)} onChange={(e) => setData('code', e.target.value)} className="uppercase" autoFocus hasError={!!err.code} />
                            </Field>
                        )}
                        <Field label="Nama" error={err.name}>
                            <Input value={String(data.name)} onChange={(e) => setData('name', e.target.value)} hasError={!!err.name} autoFocus={type === 'curricula'} />
                        </Field>

                        {(type === 'curricula' || type === 'exam-formats') && (
                            <Field label="Tahun berlaku" error={err.year_label} hint="Teks bebas, mis. 2024 atau 2022–sekarang">
                                <Input value={String(data.year_label)} onChange={(e) => setData('year_label', e.target.value)} />
                            </Field>
                        )}

                        {type === 'grades' && (
                            <>
                                <AcademicSelect
                                    levels={props.levels}
                                    value={{ level_id: String(data.level_id), grade_level_id: String(data.grade_level_id), grade_id: '' }}
                                    onChange={(v) => setData((d) => ({ ...d, level_id: v.level_id, grade_level_id: v.grade_level_id }))}
                                    errors={{ grade_level_id: err.grade_level_id }}
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Tahun ajaran" error={err.academic_year_id}>
                                        <NativeSelect value={String(data.academic_year_id)} onChange={(e) => setData('academic_year_id', e.target.value)} hasError={!!err.academic_year_id}>
                                            <option value="">Pilih…</option>
                                            {props.academic_years.map((y) => (
                                                <option key={y.id} value={y.id}>
                                                    {y.code}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                    <Field label="Peminatan (opsional)" error={err.major_id}>
                                        <NativeSelect value={String(data.major_id)} onChange={(e) => setData('major_id', e.target.value)}>
                                            <option value="">-</option>
                                            {props.majors.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.code}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                </div>
                            </>
                        )}

                        {type === 'subjects' && (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Jenis" error={err.kind}>
                                        <NativeSelect value={String(data.kind)} onChange={(e) => setData('kind', e.target.value)}>
                                            <option value="school">Mata pelajaran sekolah</option>
                                            <option value="subtest">Subtes format ujian</option>
                                        </NativeSelect>
                                    </Field>
                                    {data.kind === 'subtest' ? (
                                        <Field label="Format ujian" error={err.exam_format_id}>
                                            <NativeSelect value={String(data.exam_format_id)} onChange={(e) => setData('exam_format_id', e.target.value)} hasError={!!err.exam_format_id}>
                                                <option value="">Pilih…</option>
                                                {props.exam_formats.map((f) => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.name}
                                                    </option>
                                                ))}
                                            </NativeSelect>
                                        </Field>
                                    ) : (
                                        <label className="flex items-center gap-2 pt-7 text-sm text-gray-700 dark:text-gray-300">
                                            <Checkbox checked={data.is_elective === true} onCheckedChange={(v) => setData('is_elective', v === true)} /> Mapel pilihan (dipilih per siswa)
                                        </label>
                                    )}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Berlaku dari tingkat" error={err.min_grade} hint="Kosong = semua tingkat">
                                        <NativeSelect value={String(data.min_grade)} onChange={(e) => setData('min_grade', e.target.value)}>
                                            <option value="">-</option>
                                            {props.levels.flatMap((l) => l.grade_levels).map((g) => (
                                                <option key={g.id} value={g.number}>
                                                    {g.name}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                    <Field label="sampai tingkat" error={err.max_grade}>
                                        <NativeSelect value={String(data.max_grade)} onChange={(e) => setData('max_grade', e.target.value)}>
                                            <option value="">-</option>
                                            {props.levels.flatMap((l) => l.grade_levels).map((g) => (
                                                <option key={g.id} value={g.number}>
                                                    {g.name}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                    </Field>
                                </div>
                            </>
                        )}

                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Checkbox checked={data.is_active === true} onCheckedChange={(v) => setData('is_active', v === true)} />
                            Aktif
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
