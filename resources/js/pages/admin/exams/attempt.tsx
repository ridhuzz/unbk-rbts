import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Input } from '@/components/tremor/Input';
import { Label } from '@/components/tremor/Label';
import { Html } from '@/components/unbk/html';
import AppLayout from '@/layouts/app-layout';
import { cx } from '@/lib/tremor';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { RiArrowLeftLine, RiCheckLine, RiCloseLine } from '@remixicon/react';

interface Answer {
    id: number;
    position: number;
    number: number;
    type: 'multiple_choice' | 'essay';
    body: string;
    image: string | null;
    options: { key: string; body: string; image: string | null }[];
    answer: string | null;
    answer_key: string | null;
    is_correct: boolean | null;
    essay_answer: string | null;
    essay_score: number | null;
    is_doubtful: boolean;
    answered_at: string | null;
}

interface Props {
    exam: { id: number; name: string; subject: string };
    attempt: {
        id: number;
        exam_number: string;
        name: string;
        grade: string | null;
        class_name: string | null;
        status: string;
        correct_count: number;
        wrong_count: number;
        unanswered_count: number;
        score_mc: number | null;
        score_essay: number | null;
        total_score: number | null;
        started_at: string;
        finished_at: string | null;
        ip_address: string | null;
    };
    answers: Answer[];
}

export default function AttemptSheet({ exam, attempt, answers }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canGrade = auth.user.role !== 'proktor';
    const essays = answers.filter((a) => a.type === 'essay');
    const { data, setData, post, processing } = useForm<{ scores: Record<string, string> }>({
        scores: Object.fromEntries(essays.map((a) => [String(a.id), a.essay_score === null ? '' : String(a.essay_score)])),
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Jadwal Ujian', href: '/admin/exams' },
        { title: exam.name, href: route('admin.exams.results', exam.id) },
        { title: attempt.name, href: '#' },
    ];
    const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Lembar jawaban ${attempt.name}`} />

            <Card className="flex flex-wrap items-center gap-4">
                <Button variant="ghost" className="p-1.5" asChild>
                    <Link href={route('admin.exams.results', exam.id)} title="Kembali">
                        <RiArrowLeftLine className="size-5" />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-50">
                        {attempt.name} <span className="font-mono text-sm font-normal text-gray-500">{attempt.exam_number}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        {exam.name} · {exam.subject} · {attempt.grade ?? attempt.class_name ?? ''} · mulai {fmt(attempt.started_at)} · selesai {fmt(attempt.finished_at)} · IP {attempt.ip_address ?? '-'}
                    </div>
                </div>
                <dl className="grid grid-cols-4 gap-6 text-center">
                    <Stat v={attempt.correct_count} k="benar" cls="text-emerald-600" />
                    <Stat v={attempt.wrong_count} k="salah" cls="text-red-600" />
                    <Stat v={attempt.unanswered_count} k="kosong" />
                    <Stat v={attempt.total_score ?? '-'} k="nilai" />
                </dl>
            </Card>

            <div className="mt-4 flex flex-wrap gap-1">
                {answers.map((a) => (
                    <a
                        key={a.id}
                        href={`#q${a.id}`}
                        className={cx(
                            'flex size-8 items-center justify-center rounded-md border text-xs font-medium',
                            a.type === 'essay'
                                ? a.essay_score !== null
                                    ? 'border-violet-200 bg-violet-100 text-violet-900'
                                    : 'border-violet-300 bg-white text-violet-900'
                                : a.is_correct === true
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
                                  : a.answer
                                    ? 'border-red-200 bg-red-100 text-red-900'
                                    : 'border-gray-200 bg-white text-gray-500',
                        )}
                        title={a.answer ? `Jawab ${a.answer}` : 'Kosong'}
                    >
                        {a.position}
                    </a>
                ))}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    post(route('admin.exams.attempts.grade-essay', [exam.id, attempt.id]), { preserveScroll: true });
                }}
                className="mt-4 space-y-3"
            >
                {answers.map((a) => (
                    <Card key={a.id} id={`q${a.id}`}>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-gray-900 dark:text-gray-50">Soal {a.position}</span>
                            <span className="text-xs text-gray-500">(no. bank {a.number})</span>
                            {a.is_doubtful && <Badge variant="warning">ragu-ragu</Badge>}
                            <span className="flex-1" />
                            {a.type === 'multiple_choice' &&
                                (a.answer ? (
                                    a.is_correct ? (
                                        <span className="flex items-center gap-1 text-emerald-700">
                                            <RiCheckLine className="size-4" /> Benar
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-700">
                                            <RiCloseLine className="size-4" /> Salah (kunci {a.answer_key})
                                        </span>
                                    )
                                ) : (
                                    <span className="text-gray-500">Tidak dijawab (kunci {a.answer_key})</span>
                                ))}
                        </div>
                        {a.image && <img src={a.image} alt="" className="mb-2 max-h-60 rounded-md border" />}
                        <Html html={a.body} />
                        {a.type === 'multiple_choice' ? (
                            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                                {a.options.map((o) => (
                                    <li
                                        key={o.key}
                                        className={cx(
                                            'flex gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                                            o.key === a.answer_key ? 'border-emerald-500 bg-emerald-50' : o.key === a.answer ? 'border-red-500 bg-red-50' : 'border-gray-200',
                                        )}
                                    >
                                        <b className="w-5">{o.key}.</b>
                                        <span>
                                            {o.image && <img src={o.image} alt="" className="mb-1 max-h-32" />}
                                            <Html html={o.body} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap">{a.essay_answer ?? <i className="text-gray-500">Tidak dijawab</i>}</div>
                                <div>
                                    <Label>Nilai esai (0–100)</Label>
                                    <Input
                                        className="mt-1.5"
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.5"
                                        disabled={!canGrade}
                                        value={data.scores[String(a.id)] ?? ''}
                                        onChange={(e) => setData('scores', { ...data.scores, [String(a.id)]: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </Card>
                ))}
                {essays.length > 0 && canGrade && (
                    <div className="sticky bottom-4 flex justify-end">
                        <Button type="submit" isLoading={processing}>
                            Simpan nilai esai
                        </Button>
                    </div>
                )}
            </form>
        </AppLayout>
    );
}

function Stat({ v, k, cls }: { v: number | string; k: string; cls?: string }) {
    return (
        <div>
            <dd className={cx('text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50', cls)}>{v}</dd>
            <dt className="text-xs text-gray-500">{k}</dt>
        </div>
    );
}
