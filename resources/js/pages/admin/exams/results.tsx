import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { ProgressBar } from '@/components/tremor/ProgressBar';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tremor/Tabs';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Empty, Metric, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { cx } from '@/lib/tremor';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { type AttemptStatus } from '@/types/unbk';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { RiCalculatorLine, RiDownloadLine, RiEyeLine, RiEyeOffLine, RiFileTextLine, RiTvLine } from '@remixicon/react';

interface Result {
    id: number;
    student_id: number;
    exam_number: string;
    name: string;
    grade: string | null;
    class_name: string | null;
    status: AttemptStatus;
    correct_count: number;
    wrong_count: number;
    unanswered_count: number;
    score_mc: number | null;
    score_essay: number | null;
    total_score: number | null;
    finished_at: string | null;
}

interface Item {
    question_id: number;
    number: number;
    type: 'multiple_choice' | 'essay';
    answer_key: string | null;
    attempts: number;
    correct: number;
    correct_pct: number;
    unanswered: number;
    distribution: Record<string, number>;
    avg_essay: number | null;
}

interface ClassRecap {
    grade: string;
    count: number;
    finished: number;
    avg: number;
    max: number;
    min: number;
}

interface Props {
    exam: { id: number; name: string; subject: string; exam_date: string; mc_count: number; essay_count: number; status: string; results_published_at: string | null };
    results: Result[];
    summary: { count: number; avg: number; max: number; min: number; pending_essays: number };
    item_analysis: Item[];
    class_recap: ClassRecap[];
}

const tableCls = 'rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#090E1A]';

export default function Results({ exam, results, summary, item_analysis, class_recap }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.user.role !== 'proktor';
    const published = !!exam.results_published_at;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Jadwal Ujian', href: '/admin/exams' },
        { title: `Hasil: ${exam.name}`, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Hasil ${exam.name}`} />
            <PageHeader title={exam.name} description={`${exam.subject} · ${exam.exam_date} · ${exam.mc_count} PG${exam.essay_count ? ` + ${exam.essay_count} esai` : ''}`}>
                <Button variant="secondary" asChild>
                    <Link href={route('admin.exams.monitor', exam.id)}>
                        <RiTvLine className="-ml-0.5 size-4" /> Monitor
                    </Link>
                </Button>
                {canManage && (
                    <ConfirmDialog
                        trigger={
                            <Button variant="secondary">
                                <RiCalculatorLine className="-ml-0.5 size-4" /> Hitung ulang
                            </Button>
                        }
                        title="Hitung ulang semua nilai?"
                        description="Dipakai setelah kunci jawaban di bank soal diperbaiki."
                        onConfirm={() => router.post(route('admin.exams.results.regrade', exam.id), {}, { preserveScroll: true })}
                    />
                )}
                {canManage && (
                    <ConfirmDialog
                        trigger={
                            <Button variant={published ? 'secondary' : 'primary'}>
                                {published ? <RiEyeOffLine className="-ml-0.5 size-4" /> : <RiEyeLine className="-ml-0.5 size-4" />}
                                {published ? 'Tarik publikasi' : 'Publikasikan hasil'}
                            </Button>
                        }
                        title={published ? 'Tarik kembali publikasi hasil?' : 'Publikasikan hasil ke peserta?'}
                        description={
                            published
                                ? 'Peserta tidak lagi bisa melihat nilainya sampai dipublikasikan kembali.'
                                : 'Peserta akan melihat nilai akhir di halaman mereka. Pastikan semua esai sudah dinilai.'
                        }
                        confirmLabel={published ? 'Tarik' : 'Publikasikan'}
                        onConfirm={() => router.post(route('admin.exams.results.publish', exam.id), { published: !published }, { preserveScroll: true })}
                    />
                )}
                <Button asChild>
                    <a href={route('admin.exams.results.export', exam.id)}>
                        <RiDownloadLine className="-ml-0.5 size-4" /> Export CSV
                    </a>
                </Button>
            </PageHeader>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Card className="p-4">
                    <Metric label="Peserta" value={summary.count} />
                </Card>
                <Card className="p-4">
                    <Metric label="Rata-rata" value={summary.avg} />
                </Card>
                <Card className="p-4">
                    <Metric label="Tertinggi" value={summary.max} tone="green" />
                </Card>
                <Card className="p-4">
                    <Metric label="Terendah" value={summary.min} tone="red" />
                </Card>
                <Card className={cx('p-4', summary.pending_essays > 0 && 'border-amber-300 bg-amber-50')}>
                    <Metric label="Esai belum dinilai" value={summary.pending_essays} tone={summary.pending_essays > 0 ? 'amber' : undefined} />
                </Card>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
                {published ? (
                    <Badge variant="success">Hasil dipublikasikan {new Date(exam.results_published_at!).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</Badge>
                ) : (
                    <Badge variant="neutral">Hasil sementara, belum dipublikasikan ke peserta</Badge>
                )}
            </div>

            <Tabs defaultValue="nilai" className="mt-6">
                <TabsList>
                    <TabsTrigger value="nilai">Daftar nilai</TabsTrigger>
                    <TabsTrigger value="kelas">Rekap per kelas</TabsTrigger>
                    <TabsTrigger value="butir">Analisis butir soal</TabsTrigger>
                </TabsList>

                <TabsContent value="kelas" className="mt-4">
                    <TableRoot className={tableCls}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Kelas</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Peserta</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Selesai</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Rata-rata</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Tertinggi</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Terendah</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {class_recap.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Empty>Belum ada data.</Empty>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {class_recap.map((c) => (
                                    <TableRow key={c.grade}>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">{c.grade}</TableCell>
                                        <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{c.finished}</TableCell>
                                        <TableCell className="text-right tabular-nums">{c.avg}</TableCell>
                                        <TableCell className="text-right tabular-nums">{c.max}</TableCell>
                                        <TableCell className="text-right tabular-nums">{c.min}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                </TabsContent>

                <TabsContent value="nilai" className="mt-4">
                    <TableRoot className={tableCls}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>#</TableHeaderCell>
                                    <TableHeaderCell>Peserta</TableHeaderCell>
                                    <TableHeaderCell>Kelas</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Benar</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Salah</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Kosong</TableHeaderCell>
                                    <TableHeaderCell className="text-right">PG</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Esai</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Akhir</TableHeaderCell>
                                    <TableHeaderCell>Status</TableHeaderCell>
                                    <TableHeaderCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {results.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={11}>
                                            <Empty>Belum ada peserta yang mengerjakan.</Empty>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {results.map((r, i) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="text-gray-400">{i + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-medium text-gray-900 dark:text-gray-50">{r.name}</div>
                                            <div className="font-mono text-xs text-gray-500">{r.exam_number}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">{r.grade ?? r.class_name ?? '-'}</TableCell>
                                        <TableCell className="text-right tabular-nums text-emerald-700">{r.correct_count}</TableCell>
                                        <TableCell className="text-right tabular-nums text-red-700">{r.wrong_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.unanswered_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.score_mc ?? '-'}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.score_essay ?? '-'}</TableCell>
                                        <TableCell className="text-right text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50">{r.total_score ?? '-'}</TableCell>
                                        <TableCell className="text-xs">{r.status === 'in_progress' ? 'Mengerjakan' : r.status === 'finished' ? 'Selesai' : 'Ditutup'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" className="px-2 py-1" asChild>
                                                <Link href={route('admin.exams.attempts.show', [exam.id, r.id])}>
                                                    <RiFileTextLine className="-ml-0.5 size-4" /> Lembar
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                </TabsContent>

                <TabsContent value="butir" className="mt-4">
                    <TableRoot className={tableCls}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>No</TableHeaderCell>
                                    <TableHeaderCell>Jenis</TableHeaderCell>
                                    <TableHeaderCell>Kunci</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Dijawab</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Benar</TableHeaderCell>
                                    <TableHeaderCell>% benar</TableHeaderCell>
                                    <TableHeaderCell>Sebaran pilihan</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Kosong</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {item_analysis.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8}>
                                            <Empty>Belum ada data.</Empty>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {item_analysis.map((it) => (
                                    <TableRow key={it.question_id}>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">{it.number}</TableCell>
                                        <TableCell className="text-xs">{it.type === 'essay' ? 'Esai' : 'PG'}</TableCell>
                                        <TableCell className="font-mono">{it.answer_key ?? '-'}</TableCell>
                                        <TableCell className="text-right tabular-nums">{it.attempts - it.unanswered}</TableCell>
                                        <TableCell className="text-right tabular-nums">{it.type === 'essay' ? (it.avg_essay ?? '-') : it.correct}</TableCell>
                                        <TableCell>
                                            {it.type === 'multiple_choice' && (
                                                <div className="flex w-36 items-center gap-2">
                                                    <ProgressBar value={it.correct_pct} variant={it.correct_pct < 30 ? 'error' : it.correct_pct < 70 ? 'warning' : 'success'} className="flex-1" />
                                                    <span className="w-10 text-right text-xs tabular-nums">{it.correct_pct}%</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {Object.entries(it.distribution).map(([k, n]) => (
                                                <span key={k} className={cx('mr-2', k === it.answer_key && 'font-bold text-emerald-700')}>
                                                    {k}:{n}
                                                </span>
                                            ))}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{it.unanswered}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
