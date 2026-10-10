// Select native bergaya Tremor (untuk form sederhana; memakai inputStyles dari Input Tremor)
import { RiExpandUpDownLine } from '@remixicon/react';
import React from 'react';

import { cx, focusInput, hasErrorInput } from '@/lib/tremor';

interface NativeSelectProps extends React.ComponentPropsWithoutRef<'select'> {
    hasError?: boolean;
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, hasError, children, ...props }, ref) => (
    <div className="relative">
        <select
            ref={ref}
            className={cx(
                'peer w-full appearance-none truncate rounded-md border py-2 pr-8 pl-3 text-sm shadow-xs outline-hidden transition',
                'bg-white dark:bg-gray-950',
                'text-gray-900 dark:text-gray-50',
                'border-gray-300 dark:border-gray-800',
                'hover:bg-gray-50 dark:hover:bg-gray-950/50',
                'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500',
                focusInput,
                hasError ? hasErrorInput : '',
                className,
            )}
            {...props}
        >
            {children}
        </select>
        <RiExpandUpDownLine className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
    </div>
));
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
