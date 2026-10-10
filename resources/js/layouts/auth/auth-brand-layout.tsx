import { type SharedData } from '@/types';
import { type School } from '@/types/unbk';
import { Link, usePage } from '@inertiajs/react';
import { RiCheckboxCircleLine } from '@remixicon/react';
import { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    title: string;
    description?: string;
    /** tautan kecil di bawah form, mis. pindah ke login peserta */
    footer?: ReactNode;
}

/**
 * Layout halaman login bermerek: panel kiri identitas lembaga (logo, nama, tagline, warna tema
 * dari Pengaturan), panel kanan formulir. Di layar kecil menjadi satu kolom dengan kop ringkas.
 */
export default function AuthBrandLayout({ children, title, description, footer }: Props) {
    const { school } = usePage<SharedData & { school: School }>().props;
    const color = school?.color || '#3F3E9C';
    const name = school?.name || 'RBTS';
    const tagline = (school as School & { tagline?: string })?.tagline || '';

    return (
        <div className="flex min-h-svh bg-gray-50 text-gray-900">
            {/* ---- panel merek ---- */}
            <aside className="relative hidden w-[46%] max-w-xl flex-col justify-between overflow-hidden p-10 text-white lg:flex" style={{ background: color }}>
                {/* aksen dari warna buku di logo: kuning & merah */}
                <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-20" style={{ background: '#F5D000' }} />
                <div className="pointer-events-none absolute -bottom-28 -left-20 size-80 rounded-full opacity-15" style={{ background: '#E32B2B' }} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5" style={{ background: 'linear-gradient(90deg,#F5D000 0 50%,#E32B2B 50% 100%)' }} />

                <Link href={route('home')} className="relative flex items-center gap-4">
                    {school?.logo ? (
                        <span className="flex size-16 items-center justify-center rounded-xl bg-white p-1.5 shadow-md">
                            <img src={school.logo} alt={name} className="size-full object-contain" />
                        </span>
                    ) : (
                        <span className="flex size-16 items-center justify-center rounded-xl bg-white text-2xl font-bold shadow-md" style={{ color }}>
                            {name.slice(0, 1)}
                        </span>
                    )}
                    <span>
                        <span className="block text-lg font-semibold leading-tight">{name}</span>
                        {tagline && <span className="block text-sm text-white/80">{tagline}</span>}
                    </span>
                </Link>

                <div className="relative">
                    <h2 className="text-3xl font-semibold leading-tight">
                        Ujian Berbasis
                        <br />
                        Komputer
                    </h2>
                    <p className="mt-3 max-w-sm text-sm text-white/80">Tryout, ujian sekolah, dan simulasi UTBK-SNBT dalam satu sistem. Nilai keluar otomatis, hasil bisa dianalisis per kelas dan per butir soal.</p>
                    <ul className="mt-6 space-y-2 text-sm">
                        {['Token ujian dan waktu dikendalikan server', 'Jawaban tersimpan otomatis setiap kali dipilih', 'Monitor proktor langsung selama ujian berjalan'].map((t) => (
                            <li key={t} className="flex items-start gap-2">
                                <RiCheckboxCircleLine className="mt-0.5 size-4 shrink-0 text-[#F5D000]" />
                                <span className="text-white/90">{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-white/60">© {new Date().getFullYear()} {name}</p>
            </aside>

            {/* ---- formulir ---- */}
            <main className="flex flex-1 flex-col">
                {/* kop ringkas untuk layar kecil */}
                <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3 lg:hidden" style={{ borderTopColor: color, borderTopWidth: 4 }}>
                    {school?.logo && <img src={school.logo} alt="" className="size-9 object-contain" />}
                    <div className="leading-tight">
                        <div className="text-sm font-semibold">{name}</div>
                        {tagline && <div className="text-xs text-gray-500">{tagline}</div>}
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-sm">
                        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
                        <div className="mt-6">{children}</div>
                        {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}
                    </div>
                </div>
            </main>
        </div>
    );
}
