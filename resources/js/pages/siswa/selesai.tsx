import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import StudentLayout from '@/layouts/student-layout';
import { type School, type StudentInfo } from '@/types/unbk';
import { Head, Link } from '@inertiajs/react';
import { RiCheckboxCircleFill } from '@remixicon/react';

interface Props {
    school: School;
    student: StudentInfo;
    exam: { name: string; subject: string };
    attempt: { status: string; started_at: string; finished_at: string | null; answered: number; total: number; published: boolean; score: number | null; correct: number | null };
}

export default function Selesai({ school, student, exam, attempt }: Props) {
    const fmt = (s: string | null) => (s ? new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');

    return (
        <StudentLayout school={school} student={student}>
            <Head title="Ujian Selesai" />
            <Card className="mx-auto max-w-lg text-center">
                <RiCheckboxCircleFill className="mx-auto size-12 text-emerald-500" />
                <h1 className="mt-3 text-xl font-semibold text-gray-900">Ujian selesai</h1>
                <p className="mt-1 text-sm text-gray-500">
                    {exam.name} · {exam.subject}
                </p>
                <dl className="mt-6 grid grid-cols-3 gap-3">
                    <Stat k="Dijawab" v={`${attempt.answered}/${attempt.total}`} />
                    <Stat k="Mulai" v={fmt(attempt.started_at)} />
                    <Stat k="Selesai" v={fmt(attempt.finished_at)} />
                </dl>
                {attempt.published ? (
                    <div className="mt-6 rounded-md bg-blue-50 p-4">
                        <div className="text-xs font-medium tracking-wide text-blue-700 uppercase">Nilai Anda</div>
                        <div className="text-4xl font-semibold tabular-nums text-blue-700">{attempt.score ?? '-'}</div>
                        <div className="text-xs text-blue-700">
                            benar {attempt.correct ?? 0} dari {attempt.total} soal
                        </div>
                    </div>
                ) : (
                    <p className="mt-6 text-sm text-gray-500">Jawaban Anda sudah tersimpan. Nilai akan tampil di halaman ini setelah dirilis oleh penyelenggara.</p>
                )}
                <div className="mt-4 flex justify-center gap-2">
                    <Button variant="secondary" asChild>
                        <Link href={route('siswa.ujian.index')}>Daftar ujian</Link>
                    </Button>
                    <Button asChild>
                        <Link href={route('siswa.logout')} method="post" as="button">
                            Keluar
                        </Link>
                    </Button>
                </div>
            </Card>
        </StudentLayout>
    );
}

function Stat({ k, v }: { k: string; v: string }) {
    return (
        <div className="rounded-md bg-gray-50 p-3">
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums text-gray-900">{v}</dd>
        </div>
    );
}
