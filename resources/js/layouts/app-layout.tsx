import TremorAdminLayout from '@/layouts/tremor-admin-layout';
import { type BreadcrumbItem } from '@/types';

interface AppLayoutProps {
    children: React.ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

export default ({ children, breadcrumbs }: AppLayoutProps) => <TremorAdminLayout breadcrumbs={breadcrumbs}>{children}</TremorAdminLayout>;
