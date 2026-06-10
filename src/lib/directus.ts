const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = import.meta.env.DIRECTUS_TOKEN;

export { DIRECTUS_URL };

export async function fetchDirectus<T = unknown>(path: string): Promise<T[]> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;

	try {
		const res = await fetch(`${DIRECTUS_URL}${path}`, { headers });
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			console.error(`[directus] ${res.status} ${path}\n${body.slice(0, 500)}`);
			return [];
		}
		const json = (await res.json()) as { data?: T[] | T };
		const data = json.data;
		if (!data) return [];
		return Array.isArray(data) ? data : [data];
	} catch (err) {
		console.error(`[directus] fetch failed ${path}:`, err);
		return [];
	}
}

export function assetUrl(
	id: string | null | undefined,
	params?: Record<string, string | number>,
	fallback = ''
): string {
	if (!id) return fallback;
	const qs = params
		? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
		: '';
	return `${DIRECTUS_URL}/assets/${id}${qs}`;
}
