/**
 * Header CSRF untuk request fetch() manual (di luar router Inertia).
 * Membaca meta csrf-token; bila tidak ada, pakai cookie XSRF-TOKEN milik Laravel.
 */
export function csrfHeaders(): Record<string, string> {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    if (meta) return { 'X-CSRF-TOKEN': meta };
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...csrfHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

export async function uploadFile(url: string, file: File): Promise<{ path: string; url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(url, { method: 'POST', body: fd, headers: { Accept: 'application/json', ...csrfHeaders() }, credentials: 'same-origin' });
    if (!res.ok) throw new Error('Upload gagal');
    return (await res.json()) as { path: string; url: string };
}
