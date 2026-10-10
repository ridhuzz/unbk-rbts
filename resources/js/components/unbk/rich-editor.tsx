import { uploadFile as upload } from '@/lib/csrf';
import { cx } from '@/lib/tremor';
import { RiArrowGoBackLine, RiArrowGoForwardLine, RiBold, RiCodeLine, RiImageAddLine, RiItalic, RiListOrdered2, RiListUnordered, RiUnderline } from '@remixicon/react';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

interface Props {
    value: string;
    onChange: (html: string) => void;
    minHeight?: number;
}

async function uploadFile(file: File): Promise<string> {
    return (await upload(route('admin.questions.upload'), file)).url;
}

export function RichEditor({ value, onChange, minHeight = 120 }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const editor = useEditor({
        extensions: [StarterKit, Underline, Image.configure({ inline: true, allowBase64: false })],
        content: value,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 [&_img]:inline-block [&_img]:max-w-full',
                style: `min-height:${minHeight}px`,
            },
        },
    });

    // sinkron bila value diubah dari luar (mis. ganti soal yang diedit)
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '', false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    if (!editor) return null;

    const Tb = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cx(
                'rounded-sm p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
                active && 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-50',
            )}
        >
            {children}
        </button>
    );

    return (
        <div className="rounded-md border border-gray-300 bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 p-1 dark:border-gray-800">
                <Tb active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Tebal">
                    <RiBold className="size-4" />
                </Tb>
                <Tb active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Miring">
                    <RiItalic className="size-4" />
                </Tb>
                <Tb active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Garis bawah">
                    <RiUnderline className="size-4" />
                </Tb>
                <Tb active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Daftar">
                    <RiListUnordered className="size-4" />
                </Tb>
                <Tb active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Daftar bernomor">
                    <RiListOrdered2 className="size-4" />
                </Tb>
                <Tb active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Monospace">
                    <RiCodeLine className="size-4" />
                </Tb>
                <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-800" />
                <Tb onClick={() => fileRef.current?.click()} title="Sisipkan gambar">
                    <RiImageAddLine className="size-4" />
                </Tb>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                            const url = await uploadFile(f);
                            editor.chain().focus().setImage({ src: url }).run();
                        } catch {
                            alert('Upload gambar gagal.');
                        } finally {
                            e.target.value = '';
                        }
                    }}
                />
                <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-800" />
                <Tb onClick={() => editor.chain().focus().undo().run()} title="Undo">
                    <RiArrowGoBackLine className="size-4" />
                </Tb>
                <Tb onClick={() => editor.chain().focus().redo().run()} title="Redo">
                    <RiArrowGoForwardLine className="size-4" />
                </Tb>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
