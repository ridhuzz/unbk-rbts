import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Empty, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { type AttemptStatus } from '@/types/unbk';
import { Head, Link } from '@inertiajs/react';
import { type StudentRow } from './index';

interface Enrollment {
    id: number;
    academic_year: string | null;
    tingkat: string | null;
    grade: string | null;
    major: string | null;
    curriculum: string | null;
    school_origin: string | null;
    school_type: string | null;
}
interface Attempt {
    id: number;
    exam_id: number;
    exam: string;
    subject: string;
    exam_date: string;
    status: AttemptStatus;
    total_score: number | null;
    published: boolean;
}
interface Props {
    student: StudentRow;
    enrollments: Enrollment[];
    attempts: Attempt[];
}

export default function StudentShow({ student, enrollments, attempts }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Peserta', href: '/admin/students' },
        { title: student.name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={student.name} />
            <PageHeader title={student.name} description={`${student.exam_number} · ${student.tingkat ?? 'tingkat belum diisi'} · ${student.grade ?? 'tanpa rombel'}`}>
                <Button variant="secondary" asChild>
                    <Link href={route('admin.students.index', { q: student.exam_number })}>Kembali ke daftar</Link>
                </Button>
            </PageHeader>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-50">Profil</h2>
                    <dl className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-800">
                        {[
                            ['Nomor peserta', student.exam_number],
                            ['NISN / NIK', student.nisn],
                            ['Jenis kelamin', student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : null],
                            ['Tingkat', student.tingkat],
                            ['Rombel', student.grade ? `${student.grade} · ${student.class_name ?? ''}` : student.class_name],
                            ['Peminatan', student.major],
                            ['Kurikulum', student.curriculum],
                            ['Sekolah asal', student.school_origin ? `${student.school_origin}${student.school_type ? ` (${student.school_type})` : ''}` : null],
                            ['Sesi', String(student.session_no)],
                            ['Status', student.is_active ? 'Aktif' : 'Nonaktif'],
                        ].map(([k, v]) => (
                            <div key={k} className="flex gap-3 py-2">
                                <dt className="w-32 shrink-0 text-gray-500">{k}</dt>
                                <dd className="text-gray-900 dark:text-gray-50">{v || '-'}</dd>
                            </div>
                        ))}
                    </dl>
                </Card>

                <Card className="p-0 lg:col-span-2">
                    <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                        <h2 className="font-semibold text-gray-900 dark:text-gray-50">Riwayat keanggotaan per tahun ajaran</h2>
                    </div>
                    <TableRoot>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Tahun ajaran</TableHeaderCell>
                                    <TableHeaderCell>Tingkat</TableHeaderCell>
                                    <TableHeaderCell>Rombel</TableHeaderCell>
                                    <TableHeaderCell>Peminatan</TableHeaderCell>
                                    <TableHeaderCell>Kurikulum</TableHeaderCell>
                                    <TableHeaderCell>Sekolah</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {enrollments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <Empty>Belum ada riwayat.</Empty>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {enrollments.map((e) => (
                                    <TableRow key={e.id}>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">{e.academic_year ?? '-'}</TableCell>
                                        <TableCell>{e.tingkat ?? '-'}</TableCell>
                                        <TableCell>{e.grade ?? '-'}</TableCell>
                                        <TableCell>{e.major ?? '-'}</TableCell>
                                        <TableCell>{e.curriculum ?? '-'}</TableCell>
                                        <TableCell className="text-xs">
                                            {e.school_origin ?? '-'}
                                            {e.school_type && <span className="text-gray-500"> · {e.school_type}</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                </Card>
            </div>

            <Card className="mt-4 p-0">
                <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-50">Riwayat ujian</h2>
                </div>
                <TableRoot>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeaderCell>Tanggal</TableHeaderCell>
                                <TableHeaderCell>Ujian</TableHeaderCell>
                                <TableHeaderCell>Mata uji</TableHeaderCell>
                                <TableHeaderCell>Status</TableHeaderCell>
                                <TableHeaderCell className="text-right">Nilai</TableHeaderCell>
                                <TableHeaderCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {attempts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Empty>Belum pernah mengikuti ujian.</Empty>
                                    </TableCell>
                                </TableRow>
                            )}
                            {attempts.map((a) => (
                                <TableRow key={a.id}>
                                    <TableCell>{a.exam_date}</TableCell>
                                    <TableCell className="font-medium text-gray-900 dark:text-gray-50">{a.exam}</TableCell>
                                    <TableCell>{a.subject}</TableCell>
                                    <TableCell>
                                        {a.status === 'in_progress' ? <Badge variant="default">Mengerjakan</Badge> : a.status === 'finished' ? <Badge variant="success">Selesai</Badge> : <Badge variant="warning">Ditutup</Badge>}
                                        {a.published && (
                                            <Badge variant="neutral" className="ml-1">
                                                dirilis
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">{a.total_score ?? '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" className="px-2 py-1" asChild>
                                            <Link href={route('admin.exams.attempts.show', [a.exam_id, a.id])}>Lembar</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableRoot>
            </Card>
        </AppLayout>
    );
}
