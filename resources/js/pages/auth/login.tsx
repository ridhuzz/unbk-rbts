import { Button } from '@/components/tremor/Button';
import { Callout } from '@/components/tremor/Callout';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Input } from '@/components/tremor/Input';
import { Label } from '@/components/tremor/Label';
import AuthLayout from '@/layouts/auth-layout';
import { type SharedData } from '@/types';
import { type School } from '@/types/unbk';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface LoginForm {
    [key: string]: string | boolean;
    email: string;
    password: string;
    remember: boolean;
}

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status }: LoginProps) {
    const { school } = usePage<SharedData & { school?: School }>().props;
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <AuthLayout
            title="Masuk ke panel"
            description="Untuk admin, guru, dan proktor."
            footer={
                <>
                    Peserta ujian?{' '}
                    <Link href={route('siswa.login')} className="font-medium text-blue-600 hover:underline">
                        Masuk sebagai peserta
                    </Link>
                </>
            }
        >
            <Head title="Masuk panel" />

            {status && (
                <Callout variant="success" title="Info" className="mb-4">
                    {status}
                </Callout>
            )}

            <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        placeholder="nama@rbts.id"
                        hasError={!!errors.email}
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        hasError={!!errors.password}
                    />
                    {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <Checkbox checked={data.remember} onCheckedChange={(v) => setData('remember', v === true)} />
                    Ingat saya di perangkat ini
                </label>

                <Button type="submit" className="w-full hover:opacity-90" style={{ background: school?.color || undefined }} isLoading={processing} loadingText="Memeriksa…">
                    Masuk
                </Button>
            </form>
        </AuthLayout>
    );
}
