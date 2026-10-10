import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { BookOpenCheck, CalendarClock, Database, LayoutGrid, Settings2, Users } from 'lucide-react';
import AppLogo from './app-logo';

const examItems: NavItem[] = [
    { title: 'Dashboard', url: '/admin', icon: LayoutGrid, roles: ['admin', 'guru', 'proktor'] },
    { title: 'Jadwal & Monitor Ujian', url: '/admin/exams', icon: CalendarClock, roles: ['admin', 'guru', 'proktor'] },
    { title: 'Bank Soal', url: '/admin/banks', icon: BookOpenCheck, roles: ['admin', 'guru'] },
];

const dataItems: NavItem[] = [
    { title: 'Peserta', url: '/admin/students', icon: Users, roles: ['admin'] },
    { title: 'Data Master', url: '/admin/masters', icon: Database, roles: ['admin'] },
    { title: 'Pengaturan & Pengguna', url: '/admin/settings/school', icon: Settings2, roles: ['admin'] },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const role = auth.user?.role ?? 'proktor';
    const allowed = (items: NavItem[]) => items.filter((i) => !i.roles || i.roles.includes(role));

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/admin" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={allowed(examItems)} label="Ujian" />
                {allowed(dataItems).length > 0 && <NavMain items={allowed(dataItems)} label="Data" />}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
