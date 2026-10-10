import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { RiCheckboxCircleFill, RiCloseLine, RiErrorWarningFill } from '@remixicon/react';
import { useEffect, useState } from 'react';

export function FlashToast() {
    const { flash } = usePage<SharedData>().props;
    const [visible, setVisible] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (flash?.success) setVisible({ type: 'success', text: flash.success });
        else if (flash?.error) setVisible({ type: 'error', text: flash.error });
        else return;
        const t = setTimeout(() => setVisible(null), 5000);
        return () => clearTimeout(t);
    }, [flash?.success, flash?.error]);

    if (!visible) return null;
    const ok = visible.type === 'success';

    return (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[100] w-full max-w-sm">
            <div
                role="status"
                className="pointer-events-auto flex items-start gap-3 rounded-md border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-gray-800 dark:bg-[#090E1A]"
            >
                {ok ? <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500" /> : <RiErrorWarningFill className="size-5 shrink-0 text-red-500" />}
                <span className="flex-1 text-gray-900 dark:text-gray-50">{visible.text}</span>
                <button onClick={() => setVisible(null)} className="text-gray-400 hover:text-gray-600" aria-label="Tutup">
                    <RiCloseLine className="size-4" />
                </button>
            </div>
        </div>
    );
}
