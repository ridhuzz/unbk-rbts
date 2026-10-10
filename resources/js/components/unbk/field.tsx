import { Label } from '@/components/tremor/Label';
import { ReactNode } from 'react';

export function Field({ label, error, children, hint, className = '' }: { label: string; error?: string; children: ReactNode; hint?: string; className?: string }) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <Label className="text-gray-700 dark:text-gray-300">{label}</Label>
            {children}
            {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}

/** Judul halaman + aksi di kanan, pola standar Tremor */
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
    return (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
                {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

/** Angka ringkas ala KPI card Tremor */
export function Metric({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
    const color = { blue: 'text-blue-600', green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' }[tone ?? 'blue'];
    return (
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone ? color : 'text-gray-900 dark:text-gray-50'}`}>
                {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
            </p>
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
    );
}

/** Teks kosong untuk tabel/daftar tanpa data */
export function Empty({ children }: { children: ReactNode }) {
    return <p className="py-10 text-center text-sm text-gray-500">{children}</p>;
}
