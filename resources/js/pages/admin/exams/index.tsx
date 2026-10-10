import { Button } from '@/components/tremor/Button';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty, PageHeader } from '@/components/unbk/field';
import { Pagination } from '@/components/unbk/pagination';
import AppLayout from '@/layouts/app-layout';
import { StatusBadge } from '@/pages/admin/dashboard';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { type ExamRow, type Paginated } from '@/types/unbk';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { RiAddLine, RiBarChartBoxLine, RiDeleteBinLine, RiEyeLine, RiEyeOffLine, RiPencilLine, RiPlayLine, RiRefreshLine, RiStopLine, RiTvLine } from '@remixicon/react';

interface Props {
    exams: Paginated<ExamRow>;
    filters: { q?: string; status?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin' },
    { title: 'Jadwal Ujian', href: '/admin/exams' },
];

export default function Exams({ exams, filters }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canEdit = auth.user.role !== 'proktor';
    const icon = 'p-1.5';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Jadwal Ujian" />
            <PageHeader title="Jadwal ujian" description="Aktifkan jadwal, bagikan token, pantau peserta, lihat hasil.">
                <NativeSelect
                    className="w-44"
                    value={filters.status ?? ''}
                    onChange={(e) => router.get(route('admin.exams.index'), { status: e.target.value }, { preserveState: true, replace: true })}
                >
                    <option value="">Semua status</option>
                    <option value="draft">Draft</option>
                    <option value="active">Aktif</option>
                    <option value="finished">Selesai</option>
                </NativeSelect>
                {canEdit && (
                    <Button asChild>
                        <Link href={route('admin.exams.create')}>
                            <RiAddLine className="-ml-1 size-4" /> Jadwal baru
                        </Link>
                    </Button>
                )}
            </PageHeader>

            <TableRoot className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#090E1A]">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell>Ujian</TableHeaderCell>
                            <TableHeaderCell>Peserta</TableHeaderCell>
                            <TableHeaderCell>Tanggal & jam masuk</TableHeaderCell>
                            <TableHeaderCell>Durasi</TableHeaderCell>
                            <TableHeaderCell>Token</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell className="text-right">Selesai</TableHeaderCell>
                            <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {exams.data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Empty>Belum ada jadwal.</Empty>
                                </TableCell>
                            </TableRow>
                        )}
                        {exams.data.map((e) => (
                            <TableRow key={e.id}>
                                <TableCell>
                                    <div className="font-medium text-gray-900 dark:text-gray-50">{e.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {e.subject} · {e.bank} · {e.mc_count} PG{e.essay_count ? ` + ${e.essay_count} esai` : ''}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                    <span className="font-medium text-gray-900 dark:text-gray-50">{e.tingkat ?? 'Semua tingkat'}</span>
                                    {e.grade ? ` · ${e.grade}` : ''}
                                    <br />
                                    {e.major ?? 'Semua peminatan'} · sesi {e.session_no ?? 'semua'}
                                </TableCell>
                                <TableCell>
                                    {e.exam_date}
                                    <div className="text-xs text-gray-500">
                                        {e.start_time}–{e.late_limit_time}
                                    </div>
                                </TableCell>
                                <TableCell>{e.duration_minutes} mnt</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono tracking-widest text-gray-900 dark:text-gray-50">{e.token}</span>
                                        <button
                                            className="text-gray-400 hover:text-gray-700"
                                            title={e.show_token ? 'Token tampil ke peserta. Klik untuk sembunyikan' : 'Token disembunyikan. Klik untuk tampilkan ke peserta'}
                                            onClick={() => router.post(route('admin.exams.toggle-token', e.id), {}, { preserveScroll: true })}
                                        >
                                            {e.show_token ? <RiEyeLine className="size-4" /> : <RiEyeOffLine className="size-4" />}
                                        </button>
                                        <ConfirmDialog
                                            trigger={
                                                <button className="text-gray-400 hover:text-gray-700" title="Buat token baru">
                                                    <RiRefreshLine className="size-4" />
                                                </button>
                                            }
                                            title="Ganti token?"
                                            description="Peserta yang belum masuk harus memakai token baru."
                                            onConfirm={() => router.post(route('admin.exams.token', e.id), {}, { preserveScroll: true })}
                                        />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={e.status} window={e.window} />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {e.finished_count}/{e.attempts_count}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    {e.status !== 'active' ? (
                                        <Button variant="ghost" className={`${icon} text-emerald-600`} title="Aktifkan" onClick={() => router.post(route('admin.exams.status', e.id), { status: 'active' }, { preserveScroll: true })}>
                                            <RiPlayLine className="size-4" />
                                        </Button>
                                    ) : (
                                        <ConfirmDialog
                                            trigger={
                                                <Button variant="ghost" className={`${icon} text-amber-600`} title="Tutup ujian">
                                                    <RiStopLine className="size-4" />
                                                </Button>
                                            }
                                            title="Tutup ujian ini?"
                                            description="Peserta tidak bisa masuk lagi. Sesi yang sedang berjalan tetap bisa diselesaikan."
                                            onConfirm={() => router.post(route('admin.exams.status', e.id), { status: 'finished' }, { preserveScroll: true })}
                                        />
                                    )}
                                    <Button variant="ghost" className={icon} asChild title="Monitor proktor">
                                        <Link href={route('admin.exams.monitor', e.id)}>
                                            <RiTvLine className="size-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" className={icon} asChild title="Hasil & analisis">
                                        <Link href={route('admin.exams.results', e.id)}>
                                            <RiBarChartBoxLine className="size-4" />
                                        </Link>
                                    </Button>
                                    {canEdit && (
                                        <>
                                            <Button variant="ghost" className={icon} asChild title="Edit">
                                                <Link href={route('admin.exams.edit', e.id)}>
                                                    <RiPencilLine className="size-4" />
                                                </Link>
                                            </Button>
                                            <ConfirmDialog
                                                trigger={
                                                    <Button variant="ghost" className={`${icon} text-red-600`} title="Hapus">
                                                        <RiDeleteBinLine className="size-4" />
                                                    </Button>
                                                }
                                                title={`Hapus jadwal ${e.name}?`}
                                                description="Jadwal yang sudah dikerjakan peserta tidak bisa dihapus."
                                                destructive
                                                confirmLabel="Hapus"
                                                onConfirm={() => router.delete(route('admin.exams.destroy', e.id), { preserveScroll: true })}
                                            />
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination paginator={exams} />
            </TableRoot>
        </AppLayout>
    );
}
