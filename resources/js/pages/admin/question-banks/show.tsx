import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Field } from '@/components/unbk/field';
import { Html } from '@/components/unbk/html';
import { RichEditor } from '@/components/unbk/rich-editor';
import AppLayout from '@/layouts/app-layout';
import { uploadFile } from '@/lib/csrf';
import { cx } from '@/lib/tremor';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiImageAddLine } from '@remixicon/react';
import { useEffect, useMemo, useState } from 'react';

interface Opt {
    [key: string]: string | null | undefined;
    key: string;
    body: string;
    image: string | null;
    image_path: string | null;
}

interface Q {
    id: number;
    number: number;
    type: 'multiple_choice' | 'essay';
    body: string;
    image: string | null;
    image_path: string | null;
    audio: string | null;
    audio_path: string | null;
    options: Opt[];
    answer_key: string | null;
    shuffle_options: boolean;
    weight: number;
}

interface Props {
    bank: { id: number; code: string; name: string; subject: string | null; tingkat: string | null; major: string | null; exam_format: string | null; curriculum: string | null; option_count: number; is_active: boolean };
    questions: Q[];
}

const KEYS = ['A', 'B', 'C', 'D', 'E'];
const upload = (file: File) => uploadFile(route('admin.questions.upload'), file);

export default function BankShow({ bank, questions }: Props) {
    const [selectedId, setSelectedId] = useState<number | 'new' | null>(questions[0]?.id ?? 'new');
    const selected = useMemo(() => (selectedId === 'new' ? null : (questions.find((q) => q.id === selectedId) ?? null)), [selectedId, questions]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin' },
        { title: 'Bank Soal', href: '/admin/banks' },
        { title: bank.code, href: route('admin.banks.show', bank.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Bank soal ${bank.code}`} />
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <Card className="h-fit p-0">
                    <div className="border-b border-gray-200 p-4 dark:border-gray-800">
                        <div className="font-semibold text-gray-900 dark:text-gray-50">{bank.code}</div>
                        <div className="text-xs text-gray-500">
                            {bank.name} · {bank.subject}
                            {bank.major ? ` · ${bank.major}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {bank.tingkat ?? 'tingkat belum diisi'} · {bank.exam_format ?? '-'}
                            {bank.curriculum ? ` · ${bank.curriculum}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {questions.length} soal · opsi A–{String.fromCharCode(64 + bank.option_count)}
                        </div>
                    </div>
                    <div className="grid max-h-[60vh] grid-cols-5 gap-1.5 overflow-y-auto p-4">
                        {questions.map((q) => (
                            <button
                                key={q.id}
                                onClick={() => setSelectedId(q.id)}
                                className={cx(
                                    'h-9 rounded-md border text-sm font-medium transition',
                                    selectedId === q.id
                                        ? 'border-blue-500 bg-blue-500 text-white'
                                        : q.type === 'essay'
                                          ? 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100'
                                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                                )}
                                title={q.type === 'essay' ? 'Esai' : `Kunci ${q.answer_key ?? '?'}`}
                            >
                                {q.number}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-gray-200 p-4 dark:border-gray-800">
                        <Button className="w-full" variant={selectedId === 'new' ? 'primary' : 'secondary'} onClick={() => setSelectedId('new')}>
                            <RiAddLine className="-ml-1 size-4" /> Tambah soal
                        </Button>
                    </div>
                </Card>

                <Card>
                    <QuestionEditor key={selected?.id ?? 'new'} bankId={bank.id} optionCount={bank.option_count} question={selected} nextNumber={(questions.at(-1)?.number ?? 0) + 1} onDeleted={() => setSelectedId(questions[0]?.id ?? 'new')} />
                </Card>
            </div>
        </AppLayout>
    );
}

function QuestionEditor({ bankId, optionCount, question, nextNumber, onDeleted }: { bankId: number; optionCount: number; question: Q | null; nextNumber: number; onDeleted: () => void }) {
    const blankOptions = (): Opt[] => KEYS.slice(0, optionCount).map((k) => ({ key: k, body: '', image: null, image_path: null }));
    const { data, setData, post, put, processing, errors, transform } = useForm({
        number: question?.number ?? nextNumber,
        type: question?.type ?? 'multiple_choice',
        body: question?.body ?? '',
        image: question?.image_path ?? '',
        image_url: question?.image ?? '',
        audio: question?.audio_path ?? '',
        audio_url: question?.audio ?? '',
        options: question?.options?.length ? question.options : blankOptions(),
        answer_key: question?.answer_key ?? '',
        shuffle_options: question?.shuffle_options ?? true,
        weight: question?.weight ?? 1,
    });
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        transform((d) => ({
            number: d.number,
            type: d.type,
            body: d.body,
            image: d.image || null,
            audio: d.audio || null,
            options: d.type === 'multiple_choice' ? d.options.map((o) => ({ key: o.key, body: o.body, image: o.image_path || null })) : null,
            answer_key: d.type === 'multiple_choice' ? d.answer_key : null,
            shuffle_options: d.shuffle_options,
            weight: d.weight,
        }));
    }, [transform]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question) put(route('admin.questions.update', [bankId, question.id]), { preserveScroll: true });
        else post(route('admin.questions.store', bankId), { preserveScroll: true });
    };

    const setOpt = (i: number, patch: Partial<Opt>) => setData('options', data.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) as Opt[]);

    const pick = (accept: string, cb: (r: { path: string; url: string }) => void) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = async () => {
            const f = input.files?.[0];
            if (!f) return;
            try {
                cb(await upload(f));
            } catch {
                alert('Upload gagal.');
            }
        };
        input.click();
    };

    const err = errors as Record<string, string>;

    return (
        <form onSubmit={submit} className="grid gap-5">
            <div className="flex flex-wrap items-end gap-3">
                <Field label="No." error={err.number} className="w-20">
                    <Input type="number" min={1} value={data.number} onChange={(e) => setData('number', Number(e.target.value))} />
                </Field>
                <Field label="Jenis" error={err.type} className="w-44">
                    <NativeSelect value={data.type} onChange={(e) => setData('type', e.target.value as Q['type'])}>
                        <option value="multiple_choice">Pilihan ganda</option>
                        <option value="essay">Esai</option>
                    </NativeSelect>
                </Field>
                <Field label="Bobot" error={err.weight} className="w-24">
                    <Input type="number" min={0} step="0.5" value={data.weight} onChange={(e) => setData('weight', Number(e.target.value))} />
                </Field>
                {data.type === 'multiple_choice' && (
                    <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <Checkbox checked={data.shuffle_options} onCheckedChange={(v) => setData('shuffle_options', v === true)} /> Acak opsi
                    </label>
                )}
                <span className="flex-1" />
                <Button type="button" variant="secondary" onClick={() => setPreview((p) => !p)}>
                    {preview ? 'Tutup pratinjau' : 'Pratinjau'}
                </Button>
            </div>

            {preview ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    {data.image_url && <img src={data.image_url} alt="" className="mb-3 max-h-80 rounded-md border" />}
                    {data.audio_url && <audio controls src={data.audio_url} className="mb-3 w-full" />}
                    <Html html={data.body} />
                    {data.type === 'multiple_choice' && (
                        <ul className="mt-3 space-y-2">
                            {data.options.map((o) => (
                                <li key={o.key} className={cx('flex gap-2 rounded-md border bg-white p-2', data.answer_key === o.key ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200')}>
                                    <b className="w-5">{o.key}.</b>
                                    <span>
                                        {o.image && <img src={o.image} alt="" className="mb-1 max-h-40" />}
                                        <Html html={o.body} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <>
                    <Field label="Pertanyaan" error={err.body}>
                        <RichEditor value={data.body} onChange={(html) => setData('body', html)} minHeight={140} />
                    </Field>

                    <div className="flex flex-wrap gap-3">
                        <MediaSlot label="Gambar soal" url={data.image_url} onPick={() => pick('image/*', (r) => setData((d) => ({ ...d, image: r.path, image_url: r.url })))} onClear={() => setData((d) => ({ ...d, image: '', image_url: '' }))} kind="image" />
                        <MediaSlot label="Audio (listening)" url={data.audio_url} onPick={() => pick('audio/*', (r) => setData((d) => ({ ...d, audio: r.path, audio_url: r.url })))} onClear={() => setData((d) => ({ ...d, audio: '', audio_url: '' }))} kind="audio" />
                    </div>

                    {data.type === 'multiple_choice' && (
                        <div className="grid gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-50">Pilihan jawaban</span>
                                <span className="text-xs text-gray-500">Klik huruf untuk menandai kunci</span>
                            </div>
                            {err.options && <p className="text-xs text-red-600">{err.options}</p>}
                            {err.answer_key && <p className="text-xs text-red-600">{err.answer_key}</p>}
                            {data.options.map((o, i) => (
                                <div key={o.key} className={cx('flex gap-3 rounded-md border p-2', data.answer_key === o.key ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-200')}>
                                    <button
                                        type="button"
                                        onClick={() => setData('answer_key', o.key)}
                                        className={cx(
                                            'mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition',
                                            data.answer_key === o.key ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100',
                                        )}
                                        title="Jadikan kunci"
                                    >
                                        {o.key}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <RichEditor value={o.body} onChange={(html) => setOpt(i, { body: html })} minHeight={48} />
                                        <div className="mt-1 flex items-center gap-2 text-xs">
                                            {o.image ? (
                                                <>
                                                    <img src={o.image} alt="" className="h-10 rounded-md border" />
                                                    <button type="button" className="text-red-600" onClick={() => setOpt(i, { image: null, image_path: null })}>
                                                        hapus gambar
                                                    </button>
                                                </>
                                            ) : (
                                                <button type="button" className="flex items-center gap-1 text-gray-500 hover:text-gray-900" onClick={() => pick('image/*', (r) => setOpt(i, { image: r.url, image_path: r.path }))}>
                                                    <RiImageAddLine className="size-3.5" /> gambar opsi
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                {question && (
                    <ConfirmDialog
                        trigger={
                            <Button type="button" variant="ghost" className="text-red-600">
                                <RiDeleteBinLine className="-ml-1 size-4" /> Hapus soal
                            </Button>
                        }
                        title={`Hapus soal nomor ${question.number}?`}
                        destructive
                        confirmLabel="Hapus"
                        onConfirm={() => router.delete(route('admin.questions.destroy', [bankId, question.id]), { preserveScroll: true, onSuccess: onDeleted })}
                    />
                )}
                <span className="flex-1" />
                <Button type="submit" isLoading={processing}>
                    {question ? 'Simpan perubahan' : 'Tambahkan soal'}
                </Button>
            </div>
        </form>
    );
}

function MediaSlot({ label, url, onPick, onClear, kind }: { label: string; url: string; onPick: () => void; onClear: () => void; kind: 'image' | 'audio' }) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 p-2 text-sm dark:border-gray-800">
            <span className="text-gray-500">{label}:</span>
            {url ? (
                <>
                    {kind === 'image' ? <img src={url} alt="" className="h-10 rounded-md" /> : <audio controls src={url} className="h-8" />}
                    <button type="button" onClick={onClear} className="text-red-600" title="Hapus">
                        <RiCloseLine className="size-4" />
                    </button>
                </>
            ) : (
                <Button type="button" variant="secondary" className="px-2 py-1" onClick={onPick}>
                    <RiImageAddLine className="-ml-0.5 size-4" /> Pilih file
                </Button>
            )}
        </div>
    );
}
