import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { ProgressBar } from '@/components/tremor/ProgressBar';
import { Html } from '@/components/unbk/html';
import StudentLayout from '@/layouts/student-layout';
import { postJson } from '@/lib/csrf';
import { cx } from '@/lib/tremor';
import { type AttemptInfo, type School, type StudentInfo, type StudentQuestion } from '@/types/unbk';
import { Head, router } from '@inertiajs/react';
import { RiAlertLine, RiArrowLeftSLine, RiArrowRightSLine, RiFlagLine, RiLayoutGridLine } from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    school: School;
    student: StudentInfo;
    attempt: AttemptInfo;
    exam: { id: number; name: string; subject: string; duration_minutes: number };
    questions: StudentQuestion[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function fmtClock(total: number): string {
    const s = Math.max(0, Math.floor(total));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const d = s % 60;
    return [h, m, d].map((n) => String(n).padStart(2, '0')).join(':');
}

const letter = (i: number) => String.fromCharCode(65 + i);

export default function Ujian({ school, student, attempt, exam, questions: initial }: Props) {
    const [questions, setQuestions] = useState<StudentQuestion[]>(initial);
    const [index, setIndex] = useState(0);
    const [showNav, setShowNav] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [finishing, setFinishing] = useState(false);
    const [confirmFinish, setConfirmFinish] = useState(false);
    const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

    // Timer: hitung dari ends_at server, dikoreksi offset jam klien vs server.
    const offsetRef = useRef(new Date(attempt.server_time).getTime() - Date.now());
    const endsAtRef = useRef(new Date(attempt.ends_at).getTime());
    const [remaining, setRemaining] = useState(attempt.remaining_seconds);
    const finishRef = useRef(false);

    const current = questions[index];
    const answered = useMemo(() => questions.filter((q) => q.answer || (q.essay_answer && q.essay_answer.trim() !== '')).length, [questions]);
    const doubtful = useMemo(() => questions.filter((q) => q.is_doubtful).length, [questions]);

    const doFinish = useCallback(async () => {
        if (finishRef.current) return;
        finishRef.current = true;
        setFinishing(true);
        try {
            const res = await postJson<{ redirect: string }>(route('siswa.ujian.finish'), {});
            window.location.href = res.redirect;
        } catch {
            finishRef.current = false;
            setFinishing(false);
            router.visit(route('siswa.ujian.index'));
        }
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
            const now = Date.now() + offsetRef.current;
            const left = Math.round((endsAtRef.current - now) / 1000);
            setRemaining(left);
            if (left <= 0) void doFinish();
        }, 1000);
        return () => clearInterval(t);
    }, [doFinish]);

    // sinkron ke server tiap 30 detik (heartbeat + koreksi waktu + deteksi ditutup proktor)
    useEffect(() => {
        const sync = async () => {
            try {
                const res = await fetch(route('siswa.ujian.status'), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                if (res.status === 409) {
                    window.location.href = route('siswa.ujian.index');
                    return;
                }
                const j = (await res.json()) as { status: string; ends_at?: string; server_time: string; redirect?: string };
                offsetRef.current = new Date(j.server_time).getTime() - Date.now();
                if (j.status !== 'in_progress') {
                    finishRef.current = true; // lewati peringatan beforeunload
                    window.location.href = j.redirect ?? route('siswa.ujian.index');
                    return;
                }
                if (j.ends_at) endsAtRef.current = new Date(j.ends_at).getTime();
            } catch {
                /* jaringan putus sementara: timer lokal tetap jalan */
            }
        };
        const t = setInterval(sync, 30000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const h = (e: BeforeUnloadEvent) => {
            if (!finishRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, []);

    const patch = (id: number, changes: Partial<StudentQuestion>) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...changes } : q)));

    // Antrean jawaban yang gagal terkirim (koneksi putus): dicoba ulang otomatis, urutan per soal dipertahankan.
    const pendingRef = useRef<Map<number, { answer?: string; essay_answer?: string; is_doubtful?: boolean }>>(new Map());
    const [pendingCount, setPendingCount] = useState(0);
    const [offline, setOffline] = useState(!navigator.onLine);

    const send = useCallback(async (questionId: number, payload: { answer?: string; essay_answer?: string; is_doubtful?: boolean }) => {
        const res = await postJson<{ answer: string | null; is_doubtful: boolean }>(route('siswa.ujian.jawab'), { question_id: questionId, ...payload });
        patch(questionId, { answer: res.answer, is_doubtful: res.is_doubtful });
    }, []);

    const flushPending = useCallback(async () => {
        if (pendingRef.current.size === 0) return;
        setSaveState('saving');
        for (const [qid, payload] of Array.from(pendingRef.current.entries())) {
            try {
                await send(qid, payload);
                pendingRef.current.delete(qid);
            } catch (e) {
                if (/berakhir|Sesi|409/i.test((e as Error).message)) window.location.href = route('siswa.ujian.index');
                break; // masih gagal: coba lagi di putaran berikutnya
            }
        }
        setPendingCount(pendingRef.current.size);
        setSaveState(pendingRef.current.size ? 'error' : 'saved');
        if (!pendingRef.current.size) setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    }, [send]);

    const save = useCallback(
        async (q: StudentQuestion, payload: { answer?: string; essay_answer?: string; is_doubtful?: boolean }) => {
            // gabungkan dengan perubahan sebelumnya untuk soal yang sama
            pendingRef.current.set(q.id, { ...(pendingRef.current.get(q.id) ?? {}), ...payload });
            setPendingCount(pendingRef.current.size);
            await flushPending();
        },
        [flushPending],
    );

    useEffect(() => {
        const on = () => {
            setOffline(false);
            void flushPending();
        };
        const off = () => setOffline(true);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        const retry = setInterval(() => void flushPending(), 5000);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
            clearInterval(retry);
        };
    }, [flushPending]);

    const choose = (key: string) => {
        if (!current) return;
        patch(current.id, { answer: key });
        void save(current, { answer: key });
    };

    const essayTimer = useRef<number | null>(null);
    const typeEssay = (text: string) => {
        if (!current) return;
        patch(current.id, { essay_answer: text });
        if (essayTimer.current) window.clearTimeout(essayTimer.current);
        essayTimer.current = window.setTimeout(() => void save(current, { essay_answer: text }), 800);
    };

    const toggleDoubt = () => {
        if (!current) return;
        const v = !current.is_doubtful;
        patch(current.id, { is_doubtful: v });
        void save(current, { is_doubtful: v });
    };

    const go = (i: number) => {
        setIndex(Math.min(questions.length - 1, Math.max(0, i)));
        setShowNav(false);
        window.scrollTo({ top: 0 });
    };

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowRight') go(index + 1);
            if (e.key === 'ArrowLeft') go(index - 1);
            const k = e.key.toUpperCase();
            if (current?.type === 'multiple_choice' && k.length === 1 && k >= 'A' && k <= 'E') {
                const idx = k.charCodeAt(0) - 65;
                if (current.options[idx]) choose(current.options[idx].key);
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, questions.length, current]);

    const low = remaining <= 300;
    const fs = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' }[fontSize];

    const timer = (
        <div className={cx('rounded-md px-3 py-1.5 font-mono text-lg font-semibold tabular-nums', low ? 'bg-red-600 text-white' : 'bg-gray-900 text-white')} aria-live="off">
            {fmtClock(remaining)}
        </div>
    );

    return (
        <StudentLayout school={school} student={student} compact right={timer}>
            <Head title={`Ujian: ${exam.name}`} />

            {(offline || pendingCount > 0) && (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <RiAlertLine className="size-4 shrink-0" />
                    {offline ? 'Koneksi terputus. ' : 'Server belum bisa dihubungi. '}
                    {pendingCount > 0 ? `${pendingCount} jawaban menunggu dikirim dan akan dicoba ulang otomatis. ` : ''}
                    Jangan tutup halaman ini.
                </div>
            )}
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                {/* ---------------- Soal ---------------- */}
                <Card className="p-0">
                    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-2.5 text-sm">
                        <span className="font-medium text-gray-900">
                            {exam.subject} · {exam.name}
                        </span>
                        <span className="text-gray-500">
                            Soal {index + 1} / {questions.length}
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                            Teks:
                            {(['sm', 'base', 'lg'] as const).map((s) => (
                                <button key={s} onClick={() => setFontSize(s)} className={cx('rounded-sm px-1.5 py-0.5', fontSize === s ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100')}>
                                    {s === 'sm' ? 'A-' : s === 'base' ? 'A' : 'A+'}
                                </button>
                            ))}
                        </span>
                        <SaveBadge state={saveState} />
                    </div>

                    {current && (
                        <div className={cx('p-5', fs)}>
                            {current.audio && <audio controls src={current.audio} className="mb-3 w-full" />}
                            {current.video && <video controls src={current.video} className="mb-3 max-h-80 w-full rounded-md" />}
                            {current.image && (
                                <img src={current.image} alt="" className="mb-3 max-h-[420px] max-w-full cursor-zoom-in rounded-md border border-gray-200" onClick={() => window.open(current.image!, '_blank')} />
                            )}
                            <Html html={current.body} className={fs} />

                            {current.type === 'multiple_choice' ? (
                                <ul className="mt-5 space-y-2">
                                    {current.options.map((o, oi) => {
                                        const picked = current.answer === o.key;
                                        return (
                                            <li key={o.key}>
                                                <button
                                                    type="button"
                                                    onClick={() => choose(o.key)}
                                                    className={cx(
                                                        'flex w-full items-start gap-3 rounded-md border p-3 text-left transition',
                                                        picked ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50',
                                                    )}
                                                >
                                                    <span
                                                        className={cx(
                                                            'flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                                                            picked ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-gray-700',
                                                        )}
                                                    >
                                                        {letter(oi)}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        {o.image && <img src={o.image} alt="" className="mb-1 max-h-60 max-w-full rounded-md" />}
                                                        <Html html={o.body} className={fs} />
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <textarea
                                    className="mt-5 min-h-[200px] w-full rounded-md border border-gray-300 p-3 text-sm shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                                    placeholder="Tulis jawaban Anda di sini. Tersimpan otomatis."
                                    value={current.essay_answer ?? ''}
                                    onChange={(e) => typeEssay(e.target.value)}
                                />
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3">
                        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
                            <RiArrowLeftSLine className="-ml-1 size-4" /> Sebelumnya
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={toggleDoubt}
                            className={cx(current?.is_doubtful && 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100')}
                        >
                            <RiFlagLine className="-ml-1 size-4" /> Ragu-ragu
                        </Button>
                        <Button variant="secondary" className="lg:hidden" onClick={() => setShowNav((v) => !v)}>
                            <RiLayoutGridLine className="-ml-1 size-4" /> Daftar soal
                        </Button>
                        <span className="flex-1" />
                        {index < questions.length - 1 ? (
                            <Button onClick={() => go(index + 1)}>
                                Berikutnya <RiArrowRightSLine className="-mr-1 size-4" />
                            </Button>
                        ) : (
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmFinish(true)}>
                                Selesai ujian
                            </Button>
                        )}
                    </div>
                </Card>

                {/* ---------------- Navigasi ---------------- */}
                <Card className={cx('h-fit p-4', showNav ? 'block' : 'hidden lg:block')}>
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">Daftar soal</span>
                        <span className="text-gray-500 tabular-nums">
                            {answered}/{questions.length}
                        </span>
                    </div>
                    <ProgressBar value={questions.length ? (answered / questions.length) * 100 : 0} className="mt-2" />
                    <div className="mt-4 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
                        {questions.map((q, i) => {
                            const isAnswered = !!q.answer || (!!q.essay_answer && q.essay_answer.trim() !== '');
                            const shownIdx = q.answer ? q.options.findIndex((o) => o.key === q.answer) : -1;
                            const shown = shownIdx >= 0 ? letter(shownIdx) : null;
                            return (
                                <button
                                    key={q.id}
                                    onClick={() => go(i)}
                                    className={cx(
                                        'relative h-9 rounded-md border text-sm font-medium transition',
                                        q.is_doubtful
                                            ? 'border-amber-400 bg-amber-100 text-amber-900'
                                            : isAnswered
                                              ? 'border-blue-500 bg-blue-500 text-white'
                                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                                        i === index && 'ring-2 ring-blue-300 ring-offset-1',
                                    )}
                                    title={`Soal ${i + 1}${shown ? ` · ${shown}` : ''}`}
                                >
                                    {i + 1}
                                    {shown && <span className="absolute right-0.5 bottom-0 text-[9px] opacity-80">{shown}</span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                        <Legend cls="bg-blue-500" label="Sudah dijawab" />
                        <Legend cls="bg-amber-300" label={`Ragu-ragu (${doubtful})`} />
                        <Legend cls="border border-gray-300 bg-white" label="Belum dijawab" />
                    </div>
                    <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmFinish(true)} isLoading={finishing} loadingText="Menyimpan…">
                        Selesai ujian
                    </Button>
                </Card>
            </div>

            {/* ---------------- Konfirmasi selesai ---------------- */}
            {confirmFinish && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="max-w-md">
                        <div className="flex items-start gap-3">
                            <RiAlertLine className="mt-0.5 size-6 shrink-0 text-amber-500" />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Akhiri ujian?</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    Terjawab <b>{answered}</b> dari <b>{questions.length}</b> soal
                                    {doubtful > 0 && (
                                        <>
                                            , <b>{doubtful}</b> masih ditandai ragu-ragu
                                        </>
                                    )}
                                    . Setelah selesai Anda tidak bisa kembali ke soal.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setConfirmFinish(false)} disabled={finishing}>
                                Kembali ke soal
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doFinish()} isLoading={finishing} loadingText="Menyimpan…">
                                Ya, selesai
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </StudentLayout>
    );
}

function SaveBadge({ state }: { state: SaveState }) {
    if (state === 'idle') return null;
    const map = {
        saving: ['text-gray-500', 'Menyimpan…'],
        saved: ['text-emerald-600', 'Tersimpan'],
        error: ['text-red-600', 'Belum terkirim, mencoba ulang…'],
    } as const;
    const [cls, text] = map[state];
    return <span className={`text-xs ${cls}`}>{text}</span>;
}

function Legend({ cls, label }: { cls: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`inline-block size-3 rounded-sm ${cls}`} />
            {label}
        </div>
    );
}
