import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Input } from '@/components/tremor/Input';
import { Label } from '@/components/tremor/Label';
import StudentLayout from '@/layouts/student-layout';
import { cx } from '@/lib/tremor';
import { type AttemptHistory, type AvailableExam, type School, type StudentInfo } from '@/types/unbk';
import { Head, router, useForm } from '@inertiajs/react';
import { RiRefreshLine, RiTimeLine } from '@remixicon/react';
import { useEffect, useState } from 'react';

interface Props {
    school: School;
    student: StudentInfo;
    exams: AvailableExam[];
    history: AttemptHistory[];
    server_time: string;
}

const windowLabel: Record<AvailableExam['window'], string> = {
    inactive: 'Belum diaktifkan',
    not_started: 'Belum dibuka',
    open: 'Dibuka',
    closed: 'Batas masuk lewat',
};

export default function Konfirmasi({ school, student, exams, history, server_time }: Props) {
    const [selected, setSelected] = useState<AvailableExam | null>(exams.find((e) => e.window === 'open' && !e.attempt_status) ?? null);
    const { data, setData, post, processing, errors } = useForm({ exam_id: selected?.id ?? 0, token: '' });
    const [clock, setClock] = useState(new Date(server_time));

    useEffect(() => {
        const t = setInterval(() => setClock((c) => new Date(c.getTime() + 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        setData('exam_id', selected?.id ?? 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    const jam = clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const err = errors as Record<string, string | undefined>;

    return (
        <StudentLayout school={school} student={student}>
            <Head title="Konfirmasi Peserta" />
            <div className="grid gap-6 md:grid-cols-5">
                <Card className="md:col-span-2">
                    <h2 className="text-sm font-medium text-gray-500">Data peserta</h2>
                    <dl className="mt-3 divide-y divide-gray-100 text-sm">
                        <Row k="Nomor peserta" v={student.exam_number} />
                        <Row k="Nama" v={student.name} />
                        <Row k="Jenis kelamin" v={student.gender === 'L' ? 'Laki-laki' : student.gender === 'P' ? 'Perempuan' : '-'} />
                        <Row k="Tingkat" v={student.tingkat ?? '-'} />
                        <Row k="Rombel" v={[student.grade, student.class_name].filter(Boolean).join(' · ') || '-'} />
                        <Row k="Peminatan" v={student.major ?? '-'} />
                        <Row k="Sesi" v={String(student.session_no)} />
                    </dl>
                    <div className="mt-4 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <RiTimeLine className="size-4 text-gray-500" />
                        <span className="tabular-nums">Jam server: {jam}</span>
                        <button className="ml-auto text-gray-500 hover:text-gray-900" onClick={() => router.reload()} title="Muat ulang">
                            <RiRefreshLine className="size-4" />
                        </button>
                    </div>
                </Card>

                <Card className="md:col-span-3">
                    <h2 className="text-sm font-medium text-gray-500">Ujian hari ini</h2>
                    {exams.length === 0 && <p className="mt-3 text-sm text-gray-500">Tidak ada jadwal ujian untuk Anda hari ini.</p>}
                    <ul className="mt-3 space-y-2">
                        {exams.map((e) => {
                            const done = e.attempt_status === 'finished' || e.attempt_status === 'force_finished';
                            const selectable = e.window === 'open' && !done;
                            const active = selected?.id === e.id;
                            return (
                                <li key={e.id}>
                                    <button
                                        type="button"
                                        disabled={!selectable}
                                        onClick={() => setSelected(e)}
                                        className={cx(
                                            'w-full rounded-md border p-3 text-left transition',
                                            active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white',
                                            selectable ? 'hover:border-blue-400' : 'opacity-70',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-medium text-gray-900">{e.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {e.subject} · {e.total_questions} soal · {e.duration_minutes} menit · masuk {e.start_time}–{e.late_limit_time}
                                                </div>
                                            </div>
                                            <Badge variant={done ? 'neutral' : e.window === 'open' ? 'success' : 'warning'}>
                                                {done ? 'Sudah selesai' : e.attempt_status === 'in_progress' ? 'Sedang berjalan' : windowLabel[e.window]}
                                            </Badge>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {selected && (
                        <form
                            className="mt-5 rounded-md border border-dashed border-gray-300 p-4"
                            onSubmit={(ev) => {
                                ev.preventDefault();
                                post(route('siswa.ujian.mulai'));
                            }}
                        >
                            <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                                <p className="font-medium text-gray-900">Petunjuk pengerjaan</p>
                                {selected.instructions ? (
                                    <p className="mt-1 whitespace-pre-wrap">{selected.instructions}</p>
                                ) : (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                        <li>Waktu mulai berjalan saat Anda menekan Mulai dan dihitung oleh server.</li>
                                        <li>Jawaban tersimpan otomatis setiap kali dipilih. Memuat ulang halaman tidak menghapus jawaban.</li>
                                        <li>Gunakan tombol Ragu-ragu untuk menandai soal yang ingin ditinjau lagi.</li>
                                        <li>Tekan Selesai hanya jika sudah yakin. Setelah selesai, jawaban tidak bisa diubah.</li>
                                    </ul>
                                )}
                            </div>
                            <Label htmlFor="token">Token ujian: {selected.name}</Label>
                            <div className="mt-1.5 flex gap-2">
                                <Input
                                    id="token"
                                    value={data.token}
                                    onChange={(e) => setData('token', e.target.value.toUpperCase())}
                                    placeholder="Masukkan token dari proktor"
                                    className="font-mono uppercase tracking-widest"
                                    maxLength={10}
                                    autoFocus
                                    hasError={!!(err.token || err.exam_id || err.exam)}
                                />
                                <Button type="submit" isLoading={processing} disabled={data.token.length < 3}>
                                    Mulai
                                </Button>
                            </div>
                            {selected.show_token && selected.token_hint && (
                                <p className="mt-2 text-xs text-gray-500">
                                    Token ditampilkan proktor: <b className="font-mono tracking-widest">{selected.token_hint}</b>
                                </p>
                            )}
                            {(err.token || err.exam_id || err.exam) && <p className="mt-2 text-xs text-red-600">{err.token ?? err.exam_id ?? err.exam}</p>}
                        </form>
                    )}
                </Card>
            </div>

            {history.length > 0 && (
                <Card className="mt-6 p-0">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h2 className="text-sm font-medium text-gray-500">Riwayat ujian</h2>
                    </div>
                    <ul className="divide-y divide-gray-100">
                        {history.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-gray-900">{h.exam}</div>
                                    <div className="text-xs text-gray-500">
                                        {h.subject} · {h.exam_date}
                                    </div>
                                </div>
                                {h.published ? (
                                    <div className="text-right">
                                        <div className="text-lg font-semibold tabular-nums text-gray-900">{h.score ?? '-'}</div>
                                        <div className="text-xs text-gray-500">
                                            benar {h.correct ?? 0}/{h.total}
                                        </div>
                                    </div>
                                ) : (
                                    <Badge variant="neutral">Nilai belum dirilis</Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </StudentLayout>
    );
}

function Row({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex gap-3 py-2">
            <dt className="w-32 shrink-0 text-gray-500">{k}</dt>
            <dd className="font-medium text-gray-900">{v}</dd>
        </div>
    );
}
