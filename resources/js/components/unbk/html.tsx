import { cn } from '@/lib/utils';

/**
 * Render HTML soal/opsi dari bank soal (konten dibuat admin, bukan input peserta).
 */
export function Html({ html, className }: { html: string; className?: string }) {
    return (
        <div
            className={cn('prose prose-sm max-w-none dark:prose-invert [&_img]:inline-block [&_img]:max-w-full [&_p]:my-1', className)}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
