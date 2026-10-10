import { Badge } from '@/components/tremor/Badge';
import { Button } from '@/components/tremor/Button';
import { Card } from '@/components/tremor/Card';
import { Checkbox } from '@/components/tremor/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/tremor/Dialog';
import { Input } from '@/components/tremor/Input';
import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from '@/components/tremor/Table';
import { Textarea } from '@/components/tremor/Textarea';
import { ConfirmDialog } from '@/components/unbk/confirm-dialog';
import { Field, PageHeader } from '@/components/unbk/field';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData, type UserRole } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { useState } from 'react';

interface UserRow {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
}

interface Props {
    settings: Record<string, string | null> & { logo_url: string | null; banner_url: string | null };
    users: UserRow[];
    timezones: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin' },
    { title: 'Pengaturan', href: '/admin/settings/school' },
];

export default function Settings({ settings, users, timezones }: Props) {
    const { auth } = usePage<SharedData>().props;
    const [editing, setEditing] = useState<UserRow | null | 'new'>(null);
    const { data, setData, post, processing, errors } = useForm({
        school_name: settings.school_name ?? '',
        school_tagline: settings.school_tagline ?? '',
        school_level: settings.school_level ?? '',
        school_address: settings.school_address ?? '',
        school_phone: settings.school_phone ?? '',
        school_website: settings.school_website ?? '',
        admin_name: settings.admin_name ?? '',
        theme_color: settings.theme_color ?? '#1d4ed8',
        timezone: settings.timezone ?? 'Asia/Jakarta',
        idle_minutes: Number(settings.idle_minutes ?? 5),
        logo: null as File | null,
        banner: null as File | null,
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pengaturan" />
            <PageHeader title="Pengaturan" description="Identitas lembaga dan akun pengguna panel." />
            <div className="grid gap-6 lg:grid-cols-2">
                <Card asChild>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            post(route('admin.settings.school.update'), { forceFormData: true, preserveScroll: true });
                        }}
                    >
                        <h2 className="font-semibold text-gray-900 dark:text-gray-50">Identitas lembaga</h2>
                        <div className="mt-4 grid gap-4">
                            <Field label="Nama lembaga / sekolah" error={errors.school_name}>
                                <Input value={data.school_name} onChange={(e) => setData('school_name', e.target.value)} hasError={!!errors.school_name} />
                            </Field>
                            <Field label="Tagline" error={errors.school_tagline} hint="Tampil di halaman login di bawah nama lembaga">
                                <Input value={data.school_tagline} onChange={(e) => setData('school_tagline', e.target.value)} />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Jenjang" error={errors.school_level}>
                                    <Input value={data.school_level} onChange={(e) => setData('school_level', e.target.value)} />
                                </Field>
                                <Field label="Penanggung jawab" error={errors.admin_name}>
                                    <Input value={data.admin_name} onChange={(e) => setData('admin_name', e.target.value)} />
                                </Field>
                            </div>
                            <Field label="Alamat" error={errors.school_address}>
                                <Textarea value={data.school_address} onChange={(e) => setData('school_address', e.target.value)} />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Telepon" error={errors.school_phone}>
                                    <Input value={data.school_phone} onChange={(e) => setData('school_phone', e.target.value)} />
                                </Field>
                                <Field label="Website" error={errors.school_website}>
                                    <Input value={data.school_website} onChange={(e) => setData('school_website', e.target.value)} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <Field label="Warna tema" error={errors.theme_color}>
                                    <Input type="color" value={data.theme_color} onChange={(e) => setData('theme_color', e.target.value)} className="h-9 p-1" />
                                </Field>
                                <Field label="Zona waktu" error={errors.timezone}>
                                    <NativeSelect value={data.timezone} onChange={(e) => setData('timezone', e.target.value)}>
                                        {timezones.map((t) => (
                                            <option key={t}>{t}</option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <Field label="Batas idle (menit)" error={errors.idle_minutes} hint="Ditandai di monitor">
                                    <Input type="number" min={1} max={60} value={data.idle_minutes} onChange={(e) => setData('idle_minutes', Number(e.target.value))} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Logo" error={errors.logo}>
                                    {settings.logo_url && <img src={settings.logo_url} alt="" className="mb-1 h-12 object-contain" />}
                                    <Input type="file" accept="image/*" onChange={(e) => setData('logo', e.target.files?.[0] ?? null)} />
                                </Field>
                                <Field label="Banner" error={errors.banner}>
                                    {settings.banner_url && <img src={settings.banner_url} alt="" className="mb-1 h-12 object-contain" />}
                                    <Input type="file" accept="image/*" onChange={(e) => setData('banner', e.target.files?.[0] ?? null)} />
                                </Field>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Button type="submit" isLoading={processing}>
                                Simpan pengaturan
                            </Button>
                        </div>
                    </form>
                </Card>

                <Card className="p-0">
                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-50">Pengguna panel</h2>
                            <p className="mt-0.5 text-xs text-gray-500">Admin: semua menu. Guru: bank soal, jadwal, hasil, koreksi esai. Proktor: monitor dan hasil.</p>
                        </div>
                        <Button className="px-2.5 py-1" onClick={() => setEditing('new')}>
                            <RiAddLine className="-ml-0.5 size-4" /> Tambah
                        </Button>
                    </div>
                    <TableRoot>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Nama</TableHeaderCell>
                                    <TableHeaderCell>Email</TableHeaderCell>
                                    <TableHeaderCell>Peran</TableHeaderCell>
                                    <TableHeaderCell>Status</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">{u.name}</TableCell>
                                        <TableCell>{u.email}</TableCell>
                                        <TableCell className="capitalize">{u.role}</TableCell>
                                        <TableCell>
                                            <Badge variant={u.is_active ? 'success' : 'neutral'}>{u.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <Button variant="ghost" className="p-1.5" onClick={() => setEditing(u)}>
                                                <RiPencilLine className="size-4" />
                                            </Button>
                                            {u.id !== auth.user.id && (
                                                <ConfirmDialog
                                                    trigger={
                                                        <Button variant="ghost" className="p-1.5 text-red-600">
                                                            <RiDeleteBinLine className="size-4" />
                                                        </Button>
                                                    }
                                                    title={`Hapus pengguna ${u.name}?`}
                                                    destructive
                                                    confirmLabel="Hapus"
                                                    onConfirm={() => router.delete(route('admin.settings.users.destroy', u.id), { preserveScroll: true })}
                                                />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRoot>
                </Card>
            </div>
            {editing && <UserForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}

function UserForm({ row, onClose }: { row: UserRow | null; onClose: () => void }) {
    const { data, setData, post, put, processing, errors } = useForm({
        name: row?.name ?? '',
        email: row?.email ?? '',
        password: '',
        role: row?.role ?? 'proktor',
        is_active: row?.is_active ?? true,
    });
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (row) put(route('admin.settings.users.update', row.id), opts);
        else post(route('admin.settings.users.store'), opts);
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{row ? 'Edit pengguna' : 'Tambah pengguna'}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 grid gap-4">
                        <Field label="Nama" error={errors.name}>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} autoFocus hasError={!!errors.name} />
                        </Field>
                        <Field label="Email (untuk login)" error={errors.email}>
                            <Input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} hasError={!!errors.email} />
                        </Field>
                        <Field label={row ? 'Password baru (kosongkan jika tetap)' : 'Password'} error={errors.password}>
                            <Input type="text" value={data.password} onChange={(e) => setData('password', e.target.value)} hasError={!!errors.password} />
                        </Field>
                        <Field label="Peran" error={errors.role}>
                            <NativeSelect value={data.role} onChange={(e) => setData('role', e.target.value as UserRole)}>
                                <option value="admin">Admin</option>
                                <option value="guru">Guru</option>
                                <option value="proktor">Proktor</option>
                            </NativeSelect>
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Checkbox checked={data.is_active} onCheckedChange={(v) => setData('is_active', v === true)} /> Aktif
                        </label>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit" isLoading={processing}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
