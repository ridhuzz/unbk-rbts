import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Input } from '@/components/tremor/Input';
import { ProgressBar } from '@/components/tremor/ProgressBar';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { cx } from '@/lib/tremor';
import { StatusBadge } from '@/pages/admin/dashboard';
import { type BreadcrumbItem } from '@/types';
import { type AttemptStatus, type ExamStatus, type ExamWindow } from '@/types/unbk';
import { Head, Link, router } from '@inertiajs/react';
import { RiEyeLine, RiEyeOffLine, RiLockUnlockLine, RiPauseLine, RiPlayLine, RiRefreshLine, RiRestartLine, RiStopLine, RiTimerLine } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';

interface Participant {
    student_id: number;
    exam_number: string;
    name: string;
    grade: string | null;
    class_name: string | null;
    attempt_id: number | null;
    status: AttemptStatus | 'not_started';
    started_at: string | null;
    ends_at: string | null;
    finished_at: string | null;
    last_seen_at: string | null;
    is_idle: boolean;
    ip_address: string | null;
    answered: number;
    total: number;
    remaining_seconds: number;
    extra_minutes: number;
    total_score: number | null;
}

interface Snapshot {
    server_time: string;
    summary: { eligible: number; not_started: number; in_progress: number; finished: number };
    participants: Participant[];
    logs: { id: number; event: string; actor_type: string | null; attempt_id: number | null; meta: Record<string, unknown> | null; created_at: string }[];
}

interface Props {
    exam: {
        id: number;
        name: string;
        subject: string;
        exam_date: string;
        start_time: string;
        late_limit_time: string;
        duration_minutes: number;
        token: string;
        show_token: boolean;
        status: ExamStatus;
        window: ExamWindow;
        grade: string | null;
        major: string | null;
        session_no: number | null;
    };
    snapshot: Snapshot;
}

function statusBadge(s: Participant['status']) {
    switch (s) {
        case 'in_progress':
            return <Badge variant="default">Mengerjakan</Badge>;
        case 'finished':
            return <Badge variant="success">Selesai</Badge>;
        case 'force_finished':
            return <Badge variant="warning">Ditutup proktor</Badge>;
        default:
            return <Badge variant="neutral">Belum mulai</Badge>;
    }
}

function mmss(s: number) {
    const m = Math.floor(s / 60);
    const d = s % 60;
    return `${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')}`;
}

export default function Monitor({ exam, snapshot: initial }: Props) {
    const [snap, setSnap] = useState<Snapshot>(initial);
    const [live, setLive] = useState(true);
    const [filter, setFilter] = useState<'all' | Participant['status']>('all');
    const [q, setQ] = useState('');
    const [, setTick] = useState(0);
    const [fetchedAt, setFetchedAt] = useState(Date.now());

    useEffect(() => setSnap(initial), [initial]);

    useEffect(() => {
        if (!live) return;
        const t = setInterval(async () => {
            try {
                const res = await fetch(route('admin.exams.monitor.data', exam.id), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                if (res.ok) {
                    setSnap((await res.json()) as Snapshot);
                    setFetchedAt(Date.now());
                }
            } catch {
                /* coba lagi di tick berikutnya */
            }
        }, 5000);
        return () => clearInterval(t);
    }, [live, exam.id]);

    useEffect(() => {
        const t = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, []);

    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        return snap.participants.filter((p) => (filter === 'all' || p.status === filter) && (!s || p.name.toLowerCase().includes(s) || p.exam_number.includes(s)));
    }, [snap.participants, filter, q]);

    const elapsed = Math.floor((Date.now() - fetchedAt) / 1000);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Jadwal Ujian', href: '/admin/exams' },
        { title: `Monitor: ${exam.name}`, href: '#' },
    ];

    const act = (url: string, body: Record<string, string | number | boolean> = {}) => router.post(url, body, { preserveScroll: true, preserveState: true, only: ['snapshot', 'flash'] });
    const icon = 'p-1.5';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Monitor ${exam.name}`} />

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{exam.name}</h1>
                    <p className="mt-0.5 text-sm text-gray-500">
                        {exam.subject} · {exam.exam_date} · masuk {exam.start_time}–{exam.late_limit_time} · {exam.duration_minutes} menit · {exam.grade ?? 'semua kelas'} / {exam.major ?? 'semua jurusan'} / sesi{' '}
                        {exam.session_no ?? 'semua'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusBadge status={exam.status} window={exam.window} />
                        {exam.status !== 'active' ? (
                            <Button variant="secondary" className="px-2.5 py-1" onClick={() => router.post(route('admin.exams.status', exam.id), { status: 'active' }, { preserveScroll: true })}>
                                <RiPlayLine className="-ml-0.5 size-4" /> Aktifkan
                            </Button>
                        ) : (
                            <ConfirmDialog
                                trigger={
                                    <Button variant="secondary" className="px-2.5 py-1">
                                        <RiStopLine className="-ml-0.5 size-4" /> Tutup ujian
                                    </Button>
                                }
                                title="Tutup ujian?"
                                description="Peserta baru tidak bisa masuk. Yang sedang mengerjakan tetap bisa menyelesaikan."
                                onConfirm={() => router.post(route('admin.exams.status', exam.id), { status: 'finished' }, { preserveScroll: true })}
                            />
                        )}
                        <Button variant="secondary" className="px-2.5 py-1" asChild>
                            <Link href={route('admin.exams.results', exam.id)}>Hasil & analisis</Link>
                        </Button>
                    </div>
                </Card>

                <Card className="bg-gray-900 text-white dark:bg-gray-900">
                    <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">Token ujian</p>
                    <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]">{exam.token}</p>
                    <div className="mt-3 flex gap-2">
                        <Button variant="light" className="px-2.5 py-1" onClick={() => router.post(route('admin.exams.toggle-token', exam.id), {}, { preserveScroll: true })}>
                            {exam.show_token ? <RiEyeLine className="-ml-0.5 size-4" /> : <RiEyeOffLine className="-ml-0.5 size-4" />}
                            {exam.show_token ? 'Tampil di peserta' : 'Disembunyikan'}
                        </Button>
                        <ConfirmDialog
                            trigger={
                                <Button variant="light" className="px-2.5 py-1">
                                    <RiRefreshLine className="-ml-0.5 size-4" /> Ganti
                                </Button>
                            }
                            title="Buat token baru?"
                            onConfirm={() => router.post(route('admin.exams.token', exam.id), {}, { preserveScroll: true })}
                        />
                    </div>
                </Card>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Tile label="Peserta terdaftar" value={snap.summary.eligible} onClick={() => setFilter('all')} active={filter === 'all'} />
                <Tile label="Belum mulai" value={snap.summary.not_started} onClick={() => setFilter('not_started')} active={filter === 'not_started'} />
                <Tile label="Mengerjakan" value={snap.summary.in_progress} onClick={() => setFilter('in_progress')} active={filter === 'in_progress'} tone="text-blue-600" />
                <Tile label="Selesai" value={snap.summary.finished} onClick={() => setFilter('finished')} active={filter === 'finished'} tone="text-emerald-600" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor" className="w-56" />
                <span className="flex-1" />
                <span className="text-xs text-gray-500">Diperbarui {elapsed}s lalu</span>
                <Button variant={live ? 'primary' : 'secondary'} className="px-2.5 py-1" onClick={() => setLive((v) => !v)}>
                    {live ? <RiPauseLine className="-ml-0.5 size-4" /> : <RiPlayLine className="-ml-0.5 size-4" />} {live ? 'Live' : 'Jeda'}
                </Button>
            </div>

            <TableRoot className="mt-3 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#090E1A]">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeaderCell>Peserta</TableHeaderCell>
                            <TableHeaderCell>Kelas</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell>Progres</TableHeaderCell>
                            <TableHeaderCell>Sisa waktu</TableHeaderCell>
                            <TableHeaderCell>IP / aktivitas</TableHeaderCell>
                            <TableHeaderCell className="text-right">Nilai</TableHeaderCell>
                            <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Empty>Tidak ada peserta.</Empty>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((p) => {
                            const pct = p.total ? Math.round((p.answered / p.total) * 100) : 0;
                            const lastSeen = p.last_seen_at ? Math.max(0, Math.round((Date.now() - new Date(p.last_seen_at).getTime()) / 1000)) : null;
                            return (
                                <TableRow key={p.student_id} className={cx(p.is_idle && 'bg-amber-50 dark:bg-amber-950/20')}>
                                    <TableCell>
                                        <div className="font-medium text-gray-900 dark:text-gray-50">{p.name}</div>
                                        <div className="font-mono text-xs text-gray-500">{p.exam_number}</div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {p.grade ?? '-'}
                                        <br />
                                        {p.class_name ?? ''}
                                    </TableCell>
                                    <TableCell>
                                        {statusBadge(p.status)}
                                        {p.is_idle && <div className="mt-1 text-xs text-amber-700">idle</div>}
                                    </TableCell>
                                    <TableCell>
                                        {p.attempt_id ? (
                                            <div className="w-28">
                                                <div className="mb-1 flex justify-between text-xs tabular-nums">
                                                    <span>
                                                        {p.answered}/{p.total}
                                                    </span>
                                                    <span>{pct}%</span>
                                                </div>
                                                <ProgressBar value={pct} variant={p.status === 'in_progress' ? 'default' : 'success'} />
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono tabular-nums">
                                        {p.status === 'in_progress' ? mmss(Math.max(0, p.remaining_seconds - elapsed)) : '-'}
                                        {p.extra_minutes > 0 && <span className="ml-1 text-xs text-gray-500">(+{p.extra_minutes}m)</span>}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {p.ip_address ?? '-'}
                                        {lastSeen !== null && p.status === 'in_progress' && <div>aktif {lastSeen}s lalu</div>}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{p.total_score ?? '-'}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {p.attempt_id && p.status === 'in_progress' && (
                                            <>
                                                <AddTime onSubmit={(m) => act(route('admin.exams.attempts.add-time', [exam.id, p.attempt_id]), { minutes: m })} />
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button variant="ghost" className={`${icon} text-amber-600`} title="Paksa selesai">
                                                            <RiStopLine className="size-4" />
                                                        </Button>
                                                    }
                                                    title={`Tutup sesi ${p.name}?`}
                                                    description="Jawaban yang sudah masuk dinilai, peserta tidak bisa lanjut."
                                                    onConfirm={() => act(route('admin.exams.attempts.force-finish', [exam.id, p.attempt_id]))}
                                                />
                                            </>
                                        )}
                                        {p.attempt_id && p.status !== 'in_progress' && (
                                            <Reopen onSubmit={(m) => act(route('admin.exams.attempts.reopen', [exam.id, p.attempt_id]), { minutes: m })} name={p.name} />
                                        )}
                                        {p.attempt_id && (
                                            <ConfirmDialog
                                                trigger={
                                                    <Button variant="ghost" className={`${icon} text-red-600`} title="Reset sesi (hapus jawaban)">
                                                        <RiRestartLine className="size-4" />
                                                    </Button>
                                                }
                                                title={`Reset sesi ${p.name}?`}
                                                description="Semua jawaban peserta ini dihapus dan ia bisa mulai dari awal dengan token."
                                                destructive
                                                confirmLabel="Reset"
                                                onConfirm={() => act(route('admin.exams.attempts.reset', [exam.id, p.attempt_id]))}
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableRoot>

            <details className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-[#090E1A]">
                <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-50">Log aktivitas terakhir ({snap.logs.length})</summary>
                <ul className="mt-2 space-y-1 font-mono text-xs text-gray-500">
                    {snap.logs.map((l) => (
                        <li key={l.id}>
                            {new Date(l.created_at).toLocaleTimeString('id-ID')} · {l.event} · {l.actor_type ?? '-'} · sesi #{l.attempt_id ?? '-'} {l.meta ? JSON.stringify(l.meta) : ''}
                        </li>
                    ))}
                </ul>
            </details>
        </AppLayout>
    );
}

function Tile({ label, value, onClick, active, tone }: { label: string; value: number; onClick: () => void; active: boolean; tone?: string }) {
    return (
        <Card asChild className={cx('cursor-pointer p-4 transition hover:bg-gray-50', active && 'ring-2 ring-blue-500')}>
            <button type="button" onClick={onClick}>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={cx('mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50', tone)}>{value}</p>
            </button>
        </Card>
    );
}

function AddTime({ onSubmit }: { onSubmit: (minutes: number) => void }) {
    const [m, setM] = useState(10);
    return (
        <ConfirmDialog
            trigger={
                <Button variant="ghost" className="p-1.5" title="Tambah waktu">
                    <RiTimerLine className="size-4" />
                </Button>
            }
            title="Tambah waktu peserta"
            confirmLabel="Tambahkan"
            onConfirm={() => onSubmit(m)}
        >
            <div className="flex items-center gap-2 text-sm">
                <Input type="number" min={1} max={180} value={m} onChange={(e) => setM(Number(e.target.value))} className="w-24" /> menit
            </div>
        </ConfirmDialog>
    );
}

function Reopen({ onSubmit, name }: { onSubmit: (minutes: number) => void; name: string }) {
    const [m, setM] = useState(15);
    return (
        <ConfirmDialog
            trigger={
                <Button variant="ghost" className="p-1.5" title="Buka kembali sesi">
                    <RiLockUnlockLine className="size-4" />
                </Button>
            }
            title={`Buka kembali sesi ${name}?`}
            description="Peserta harus login ulang dan memasukkan token. Jawaban sebelumnya tetap ada."
            confirmLabel="Buka"
            onConfirm={() => onSubmit(m)}
        >
            <div className="flex items-center gap-2 text-sm">
                Beri waktu <Input type="number" min={1} max={300} value={m} onChange={(e) => setM(Number(e.target.value))} className="w-24" /> menit
            </div>
        </ConfirmDialog>
    );
}
