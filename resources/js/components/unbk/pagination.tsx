import { Button } from '@/components/tremor/Button';
import { type Paginated } from '@/types/unbk';
import { Link } from '@inertiajs/react';

export function Pagination({ paginator }: { paginator: Paginated<unknown> }) {
    if (paginator.last_page <= 1) return null;
    const prev = paginator.links[0];
    const next = paginator.links[paginator.links.length - 1];

    return (
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-500 dark:border-gray-800">
            <span>
                {paginator.from ?? 0}–{paginator.to ?? 0} dari {paginator.total}
            </span>
            <div className="flex items-center gap-2">
                <span className="text-xs">
                    Hal. {paginator.current_page} / {paginator.last_page}
                </span>
                <Button variant="secondary" className="px-2 py-1" asChild disabled={!prev.url}>
                    <Link href={prev.url ?? '#'} preserveScroll preserveState>
                        Sebelumnya
                    </Link>
                </Button>
                <Button variant="secondary" className="px-2 py-1" asChild disabled={!next.url}>
                    <Link href={next.url ?? '#'} preserveScroll preserveState>
                        Berikutnya
                    </Link>
                </Button>
            </div>
        </div>
    );
}
