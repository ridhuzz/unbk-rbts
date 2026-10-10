import AuthBrandLayout from '@/layouts/auth/auth-brand-layout';
import { ReactNode } from 'react';

export default function AuthLayout({ children, title, description, footer }: { children: ReactNode; title: string; description?: string; footer?: ReactNode }) {
    return (
        <AuthBrandLayout title={title} description={description} footer={footer}>
            {children}
        </AuthBrandLayout>
    );
}
