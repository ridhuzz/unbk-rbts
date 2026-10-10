import { FlashToast } from '@/components/flash-toast';
import { cx, focusRing } from '@/lib/tremor';
import { useAppUrl } from '@/lib/url';
import { type BreadcrumbItem, type NavItem, type SharedData } from '@/types';
import { type School } from '@/types/unbk';
import { Link, usePage } from '@inertiajs/react';
import {
    RiArrowRightSLine,
    RiBookOpenLine,
    RiCalendarEventLine,
    RiDashboardLine,
    RiDatabase2Line,
    RiGroupLine,
    RiLogoutBoxRLine,
    RiMenuLine,
    RiSettings3Line,
} from '@remixicon/react';
import { ReactNode, useState } from 'react';

const examItems: NavItem[] = [
    { title: 'Dashboard', url: '/admin', icon: null, roles: ['admin', 'guru', 'proktor'] },
    { title: 'Jadwal & Monitor', url: '/admin/exams', icon: null, roles: ['admin', 'guru', 'proktor'] },
    { title: 'Bank Soal', url: '/admin/banks', icon: null, roles: ['admin', 'guru'] },
];
const dataItems: NavItem[] = [
    { title: 'Peserta', url: '/admin/students', icon: null, roles: ['admin'] },
    { title: 'Data Master', url: '/admin/masters', icon: null, roles: ['admin'] },
    { title: 'Pengaturan', url: '/admin/settings/school', icon: null, roles: ['admin'] },
];
const icons: Record<string, typeof RiDashboardLine> = {
    '/admin': RiDashboardLine,
    '/admin/exams': RiCalendarEventLine,
    '/admin/banks': RiBookOpenLine,
    '/admin/students': RiGroupLine,
    '/admin/masters': RiDatabase2Line,
    '/admin/settings/school': RiSettings3Line,
};

interface Props {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

/**
 * Layout panel bergaya Tremor: sidebar putih tetap di kiri, konten abu-abu muda.
 */
export default function TremorAdminLayout({ children, breadcrumbs = [] }: Props) {
    const { auth, name, school } = usePage<SharedData & { school?: School }>().props;
    const { url, basePath } = useAppUrl();
    // path halaman saat ini tanpa subfolder, agar penanda menu aktif tetap benar di subfolder
    const current = usePage().url.split('?')[0].replace(basePath, '') || '/';
    const [open, setOpen] = useState(false);
    const role = auth.user?.role ?? 'proktor';
    const allowed = (items: NavItem[]) => items.filter((i) => !i.roles || i.roles.includes(role));

    const NavList = ({ items, label }: { items: NavItem[]; label: string }) => (
        <div>
            <p className="px-3 text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
            <ul className="mt-1 space-y-0.5">
                {items.map((item) => {
                    const Icon = icons[item.url] ?? RiDashboardLine;
                    const active = item.url === '/admin' ? current === '/admin' : current.startsWith(item.url);
                    return (
                        <li key={item.url}>
                            <Link
                                href={url(item.url)}
                                prefetch
                                onClick={() => setOpen(false)}
                                className={cx(
                                    'flex items-center gap-x-2.5 rounded-md px-3 py-2 text-sm font-medium transition',
                                    active
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900',
                                    focusRing,
                                )}
                            >
                                <Icon className="size-4 shrink-0" aria-hidden="true" />
                                {item.title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    const sidebar = (
        <div className="flex h-full flex-col gap-y-6 bg-white px-3 py-4 dark:bg-gray-950">
            <Link href={url('/admin')} className="flex items-center gap-x-2.5 px-3">
                {school?.logo ? (
                    <img src={school.logo} alt="" className="size-9 shrink-0 object-contain" />
                ) : (
                    <span className="flex size-8 items-center justify-center rounded-md text-sm font-bold text-white" style={{ background: school?.color || '#3F3E9C' }}>
                        {(school?.name || name).slice(0, 1)}
                    </span>
                )}
                <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">{school?.name || name}</div>
                    <div className="text-xs text-gray-500">Panel ujian</div>
                </div>
            </Link>
            <nav className="flex flex-1 flex-col gap-y-6">
                <NavList items={allowed(examItems)} label="Ujian" />
                {allowed(dataItems).length > 0 && <NavList items={allowed(dataItems)} label="Data" />}
            </nav>
            <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
                <div className="flex items-center gap-x-3 px-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {auth.user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{auth.user.name}</div>
                        <div className="text-xs text-gray-500 capitalize">{auth.user.role}</div>
                    </div>
                    <Link href={route('logout')} method="post" as="button" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900" title="Keluar">
                        <RiLogoutBoxRLine className="size-4" />
                    </Link>
                </div>
                <Link href={route('profile.edit')} className="mt-2 block px-3 text-xs text-gray-500 hover:text-gray-900">
                    Profil & password
                </Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 lg:block dark:border-gray-800">{sidebar}</aside>
            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-64 border-r border-gray-200 shadow-xl dark:border-gray-800">{sidebar}</aside>
                </div>
            )}
            <div className="lg:pl-64">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-x-3 border-b border-gray-200 bg-white px-4 sm:px-6 dark:border-gray-800 dark:bg-gray-950">
                    <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
                        <RiMenuLine className="size-5" />
                    </button>
                    <nav className="flex items-center gap-x-1 text-sm">
                        {breadcrumbs.map((b, i) => {
                            const last = i === breadcrumbs.length - 1;
                            return (
                                <span key={i} className="flex items-center gap-x-1">
                                    {i > 0 && <RiArrowRightSLine className="size-4 text-gray-400" />}
                                    {last || b.href === '#' ? (
                                        <span className={last ? 'font-medium text-gray-900 dark:text-gray-50' : 'text-gray-500'}>{b.title}</span>
                                    ) : (
                                        <Link href={url(b.href)} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-50">
                                            {b.title}
                                        </Link>
                                    )}
                                </span>
                            );
                        })}
                    </nav>
                </header>
                <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
            </div>
            <FlashToast />
        </div>
    );
}
