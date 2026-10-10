import { type School, type StudentInfo } from '@/types/unbk';
import { Link } from '@inertiajs/react';
import { RiLogoutBoxRLine, RiUserLine } from '@remixicon/react';
import { ReactNode } from 'react';

interface Props {
    school: School;
    student?: StudentInfo;
    children: ReactNode;
    compact?: boolean;
    right?: ReactNode;
}

/**
 * Bingkai halaman peserta bergaya Tremor: header putih bergaris, konten abu-abu muda.
 */
export default function StudentLayout({ school, student, children, compact, right }: Props) {
    return (
        <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
            <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
                <div className={`mx-auto flex w-full items-center gap-4 px-4 sm:px-6 ${compact ? 'max-w-[1400px] py-2' : 'max-w-5xl py-3'}`}>
                    {school.logo ? (
                        <img src={school.logo} alt="" className="size-9 rounded-md object-contain" />
                    ) : (
                        <div className="flex size-9 items-center justify-center rounded-md bg-blue-500 text-sm font-bold text-white">{school.name.slice(0, 1)}</div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold leading-tight">{school.name}</div>
                        <div className="text-xs text-gray-500">Ujian berbasis komputer</div>
                    </div>
                    {right}
                    {student && (
                        <div className="flex items-center gap-3">
                            {student.photo ? (
                                <img src={student.photo} alt="" className="size-9 rounded-full object-cover" />
                            ) : (
                                <div className="flex size-9 items-center justify-center rounded-full bg-gray-100">
                                    <RiUserLine className="size-5 text-gray-500" />
                                </div>
                            )}
                            <div className="hidden text-right sm:block">
                                <div className="text-sm font-medium leading-tight">{student.name}</div>
                                <div className="text-xs text-gray-500">
                                    {student.exam_number}
                                    {student.grade ? ` · ${student.grade}` : ''}
                                </div>
                            </div>
                            <Link
                                href={route('siswa.logout')}
                                method="post"
                                as="button"
                                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                                title="Keluar"
                                onClick={(e) => {
                                    if (!confirm('Keluar dari aplikasi ujian?')) e.preventDefault();
                                }}
                            >
                                <RiLogoutBoxRLine className="size-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </header>
            <main className={`mx-auto w-full flex-1 px-4 sm:px-6 ${compact ? 'max-w-[1400px] py-4' : 'max-w-5xl py-8'}`}>{children}</main>
            <footer className="py-4 text-center text-xs text-gray-400">{school.name} · CBT</footer>
        </div>
    );
}
