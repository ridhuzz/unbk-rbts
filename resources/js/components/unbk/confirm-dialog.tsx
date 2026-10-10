import { Button } from '@/components/tremor/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/tremor/Dialog';
import { ReactNode, useState } from 'react';

interface Props {
    trigger: ReactNode;
    title: string;
    description?: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    children?: ReactNode;
}

/**
 * Tombol dengan dialog konfirmasi. `trigger` harus elemen yang bisa menerima onClick.
 */
export function ConfirmDialog({ trigger, title, description, confirmLabel = 'Ya, lanjutkan', destructive, onConfirm, children }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <span onClick={() => setOpen(true)} className="inline-flex">
                {trigger}
            </span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && <DialogDescription className="mt-1 text-sm leading-6">{description}</DialogDescription>}
                    </DialogHeader>
                    {children && <div className="mt-4">{children}</div>}
                    <DialogFooter className="mt-6">
                        <Button variant="secondary" onClick={() => setOpen(false)}>
                            Batal
                        </Button>
                        <Button
                            variant={destructive ? 'destructive' : 'primary'}
                            onClick={() => {
                                setOpen(false);
                                onConfirm();
                            }}
                        >
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
