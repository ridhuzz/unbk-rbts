import { Button } from '@/components/tremor/Button';
import { Callout } from '@/components/tremor/Callout';
import { Input } from '@/components/tremor/Input';
import { Label } from '@/components/tremor/Label';
import AuthLayout from '@/layouts/auth-layout';
import { type SharedData } from '@/types';
import { type School } from '@/types/unbk';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function StudentLogin() {
    const { flash, school } = usePage<SharedData & { school?: School }>().props;
    const { data, setData, post, processing, errors, reset } = useForm({ exam_number: '', password: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('siswa.login.store'), { onFinish: () => reset('password') });
    };

    return (
        <AuthLayout
            title="Masuk sebagai peserta"
            description="Gunakan nomor peserta dan password yang diberikan proktor."
            footer={
                <>
                    Petugas?{' '}
                    <Link href={route('login')} className="font-medium text-blue-600 hover:underline">
                        Masuk ke panel
                    </Link>
                </>
            }
        >
            <Head title="Login Peserta" />
            {flash?.error && (
                <Callout variant="error" title="Perhatian" className="mb-4">
                    {flash.error}
                </Callout>
            )}
            <form onSubmit={submit} className="space-y-5">
                <div className="space-y-1.5">
                    <Label htmlFor="exam_number">Nomor peserta</Label>
                    <Input
                        id="exam_number"
                        autoFocus
                        autoComplete="username"
                        inputMode="numeric"
                        value={data.exam_number}
                        onChange={(e) => setData('exam_number', e.target.value)}
                        placeholder="contoh: 1570002744"
                        className="font-mono text-base tracking-wide"
                        hasError={!!errors.exam_number}
                    />
                    {errors.exam_number && <p className="text-xs text-red-600">{errors.exam_number}</p>}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" autoComplete="current-password" value={data.password} onChange={(e) => setData('password', e.target.value)} hasError={!!errors.password} />
                    {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full hover:opacity-90" style={{ background: school?.color || undefined }} isLoading={processing} loadingText="Memeriksa…">
                    Masuk
                </Button>
            </form>
        </AuthLayout>
    );
}
