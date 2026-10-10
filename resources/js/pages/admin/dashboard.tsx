import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Empty, Metric, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type ExamStatus, type ExamWindow } from '@/types/unbk';
import { Head, Link } from '@inertiajs/react';

interface TodayExam {
    id: number;
    name: string;
    subject: string;
    start_time: string;
    late_limit_time: string;
    status: ExamStatus;
    window: ExamWindow;
    token: string;
    attempts_count: number;
    in_progress_count: number;
    finished_count: number;
}

interface Props {
    stats: { students: number; question_banks: number; questions: number; exams_active: number };
    today_exams: TodayExam[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/admin' }];

export default function Dashboard({ stats, today_exams }: Props) {
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <PageHeader title="Dashboard" description={today} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card asChild>
                    <Link href={route('admin.students.index')}>
                        <Metric label="Peserta aktif" value={stats.students} />
                    </Link>
                </Card>
                <Card asChild>
                    <Link href={route('admin.banks.index')}>
                        <Metric label="Bank soal" value={stats.question_banks} />
                    </Link>
                </Card>
                <Card asChild>
                    <Link href={route('admin.banks.index')}>
                        <Metric label="Total soal" value={stats.questions} />
                    </Link>
                </Card>
                <Card asChild>
                    <Link href={route('admin.exams.index', { status: 'active' })}>
                        <Metric label="Ujian aktif" value={stats.exams_active} tone="blue" />
                    </Link>
                </Card>
            </div>

            <Card className="mt-6 p-0">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-50">Ujian hari ini</h2>
                    <Button variant="secondary" asChild>
                        <Link href={route('admin.exams.index')}>Semua jadwal</Link>
                    </Button>
                </div>
                {today_exams.length === 0 ? (
                    <Empty>Tidak ada jadwal ujian hari ini.</Empty>
                ) : (
                    <TableRoot>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Ujian</TableHeaderCell>
                                    <TableHeaderCell>Jam masuk</TableHeaderCell>
                                    <TableHeaderCell>Token</TableHeaderCell>
                                    <TableHeaderCell>Status</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Mengerjakan</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Selesai</TableHeaderCell>
                                    <TableHeaderCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {today_exams.map((e) => (
                                    <TableRow key={e.id}>
                                        <TableCell>
                                            <div className="font-medium text-gray-900 dark:text-gray-50">{e.name}</div>
                                            <div className="text-xs text-gray-500">{e.subject}</div>
                                        </TableCell>
                                        <TableCell>
                                            {e.start_time}–{e.late_limit_time}
                                        </TableCell>
                                        <TableCell className="font-mono tracking-widest">{e.token}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={e.status} window={e.window} />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{e.in_progress_count}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {e.finished_count}/{e.attempts_count}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild className="px-2.5 py-1">
                                                <Link href={route('admin.exams.monitor', e.id)}>Monitor</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                )}
            </Card>
        </AppLayout>
    );
}

export function StatusBadge({ status, window }: { status: ExamStatus; window?: ExamWindow }) {
    if (status === 'draft') return <Badge variant="neutral">Draft</Badge>;
    if (status === 'finished') return <Badge variant="neutral">Selesai</Badge>;
    if (window === 'open') return <Badge variant="success">Aktif · dibuka</Badge>;
    if (window === 'not_started') return <Badge variant="warning">Aktif · belum jam</Badge>;
    if (window === 'closed') return <Badge variant="warning">Aktif · masuk ditutup</Badge>;
    return <Badge variant="default">Aktif</Badge>;
}
