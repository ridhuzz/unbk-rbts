import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Tautan absolut yang mengikuti URL dasar aplikasi, sehingga tetap benar
 * saat aplikasi dipasang di subfolder (mis. http://localhost/new-unbk/public).
 */
export function useAppUrl() {
    const { base_url } = usePage<SharedData>().props;
    const base = (base_url ?? '').replace(/\/$/, '');
    let basePath = '';
    try {
        basePath = new URL(base).pathname.replace(/\/$/, '');
    } catch {
        basePath = '';
    }

    return {
        /** '/admin/exams' -> 'http://host/subfolder/admin/exams' */
        url: (path: string) => (/^https?:\/\//.test(path) ? path : base + path),
        /** path relatif terhadap subfolder, untuk membandingkan dengan page.url */
        basePath,
    };
}
