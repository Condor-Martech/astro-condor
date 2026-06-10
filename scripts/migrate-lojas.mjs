/**
 * WordPress to Directus Migration Script — Lojas
 *
 * Migrates ALL published lojas (stores) from WordPress custom post type
 * (institucional.condor.com.br) into Directus `lojas` collection,
 * including featured images. Applies the same malware sanitizer used
 * for posts, since the source WordPress site is known to be compromised.
 *
 * Usage:
 *   DIRECTUS_TOKEN=your_token node scripts/migrate-lojas.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config / env
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

function loadEnv() {
	try {
		const raw = readFileSync(resolve(PROJECT_ROOT, '.env'), 'utf-8');
		for (const line of raw.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			let value = trimmed.slice(eqIdx + 1).trim();
			if ((value.startsWith('"') && value.endsWith('"')) ||
			    (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {}
}

loadEnv();

const WP_BASE = 'https://institucional.condor.com.br/wp-json/wp/v2';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

if (!DIRECTUS_TOKEN) {
	console.warn('\n⚠  DIRECTUS_TOKEN not set. Requests will be sent without auth — this may fail.\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function directusHeaders() {
	const h = { 'Content-Type': 'application/json' };
	if (DIRECTUS_TOKEN) h['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
	return h;
}

// ---------------------------------------------------------------------------
// Sanitization (same as migrate-posts.mjs — WP source is compromised)
// ---------------------------------------------------------------------------

function sanitizeDangerous(html) {
	let s = String(html || '');
	s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
	s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
	s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
	s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
	s = s.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
	s = s.replace(/<embed\b[^>]*\/?>/gi, '');
	s = s.replace(/<applet\b[^>]*>[\s\S]*?<\/applet>/gi, '');
	s = s.replace(/(?:\\?x[0-9a-fA-F]{2}){6,}/g, '');
	s = s.replace(/_0x[0-9a-fA-F]{3,}/g, '');
	s = s.replace(/(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"');
	s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '');
	s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');
	return s;
}

function decodeHtmlEntities(str) {
	const map = {
		'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
		'&#039;': "'", '&#8217;': '’', '&#8216;': '‘',
		'&#8220;': '“', '&#8221;': '”', '&#8211;': '–',
		'&#8212;': '—', '&nbsp;': ' ', '&#8230;': '…',
	};
	let r = String(str || '');
	for (const [e, c] of Object.entries(map)) r = r.replaceAll(e, c);
	r = r.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
	r = r.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
	return r;
}

// ---------------------------------------------------------------------------
// WordPress fetch
// ---------------------------------------------------------------------------

async function fetchAllLojas() {
	console.log('Fetching lojas from WordPress...');
	const perPage = 100;
	let page = 1;
	let all = [];

	while (true) {
		const url = `${WP_BASE}/lojas?status=publish&per_page=${perPage}&page=${page}`;
		const res = await fetch(url);
		if (!res.ok) {
			if (res.status === 400) break;
			throw new Error(`WP API ${res.status}`);
		}
		const items = await res.json();
		if (!items.length) break;
		all = all.concat(items);
		const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
		console.log(`  Page ${page}/${totalPages} — fetched ${items.length} (total: ${all.length})`);
		if (page >= totalPages) break;
		page++;
		await sleep(100);
	}

	console.log(`Total lojas fetched: ${all.length}\n`);
	return all;
}

// ---------------------------------------------------------------------------
// Image import (same pattern as posts)
// ---------------------------------------------------------------------------

const mediaUrlCache = new Map();
const importedImageCache = new Map();

async function getWpMediaUrl(mediaId) {
	if (mediaUrlCache.has(mediaId)) return mediaUrlCache.get(mediaId);
	try {
		const res = await fetch(`${WP_BASE}/media/${mediaId}?_fields=id,source_url`);
		if (!res.ok) throw new Error(`Status ${res.status}`);
		const data = await res.json();
		mediaUrlCache.set(mediaId, data.source_url);
		return data.source_url;
	} catch (err) {
		console.error(`  [WARN] Failed to fetch media ${mediaId}: ${err.message}`);
		return null;
	}
}

async function importImageToDirectus(imageUrl, title = '') {
	if (importedImageCache.has(imageUrl)) return importedImageCache.get(imageUrl);
	try {
		const res = await fetch(`${DIRECTUS_URL}/files/import`, {
			method: 'POST',
			headers: directusHeaders(),
			body: JSON.stringify({
				url: imageUrl,
				data: { title: title || imageUrl.split('/').pop(), description: title || '' },
			}),
		});
		if (!res.ok) throw new Error(`Status ${res.status}: ${(await res.text()).slice(0, 120)}`);
		const data = await res.json();
		const fileId = data.data.id;
		importedImageCache.set(imageUrl, fileId);
		return fileId;
	} catch (err) {
		console.error(`  [WARN] Failed to import image ${imageUrl}: ${err.message}`);
		return null;
	}
}

// ---------------------------------------------------------------------------
// Lat/lng normalization
// ---------------------------------------------------------------------------

/**
 * In several lojas, meta.latitude contains BOTH coordinates separated by a space
 * (e.g. "-25.391347 -49.188718"). Pull lat from there if it parses, fall back
 * to whatever the longitude field has.
 */
function parseLatLng(latRaw, lngRaw) {
	const latStr = String(latRaw || '').trim();
	const lngStr = String(lngRaw || '').trim();

	const parts = latStr.split(/\s+/).filter(Boolean);
	const latitude = parts[0] || '';
	// If latitude field had two values and longitude field is empty, recover lng from there.
	const longitude = lngStr || parts[1] || '';

	return { latitude, longitude };
}

// ---------------------------------------------------------------------------
// Directus item create
// ---------------------------------------------------------------------------

async function createLoja(item) {
	try {
		const res = await fetch(`${DIRECTUS_URL}/items/lojas`, {
			method: 'POST',
			headers: directusHeaders(),
			body: JSON.stringify(item),
		});
		if (res.ok) return { created: true };
		const body = await res.text();
		if (res.status === 409 || body.includes('UNIQUE') || body.includes('unique') || body.includes('duplicate')) {
			return { skipped: true, reason: 'Duplicate slug' };
		}
		return { error: true, reason: `HTTP ${res.status}: ${body.slice(0, 200)}` };
	} catch (err) {
		return { error: true, reason: err.message };
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('='.repeat(60));
	console.log('  WordPress -> Directus Migration (lojas)');
	console.log(`  WP Source:  ${WP_BASE}/lojas`);
	console.log(`  Directus:   ${DIRECTUS_URL}`);
	console.log(`  Auth:       ${DIRECTUS_TOKEN ? 'Bearer token set' : 'NO TOKEN'}`);
	console.log('='.repeat(60));
	console.log();

	const lojas = await fetchAllLojas();
	if (!lojas.length) {
		console.log('No lojas to migrate. Done.');
		return;
	}

	const stats = { total: lojas.length, imported: 0, skipped: 0, errors: 0 };

	for (let i = 0; i < lojas.length; i++) {
		const loja = lojas[i];
		const nome = decodeHtmlEntities(loja.title?.rendered || '');
		console.log(`[${i + 1}/${lojas.length}] ${nome}`);

		// Featured image
		let imageId = null;
		if (loja.featured_media > 0) {
			const mediaUrl = await getWpMediaUrl(loja.featured_media);
			if (mediaUrl) {
				imageId = await importImageToDirectus(mediaUrl, nome);
				if (imageId) console.log(`  image: ${imageId}`);
				await sleep(100);
			}
		}

		// Meta fields
		const meta = loja.meta || {};
		const { latitude, longitude } = parseLatLng(meta.latitude, meta.longitude);

		const item = {
			status: 'published',
			nome,
			slug: loja.slug,
			cidade: decodeHtmlEntities(meta.cidade || ''),
			telefone: String(meta.telefone || ''),
			link_maps: String(meta['link-do-maps'] || ''),
			latitude,
			longitude,
			image: imageId,
			horarios: sanitizeDangerous(meta.horarios || ''),
			setores: decodeHtmlEntities(String(meta.setores || '')),
			servicos: decodeHtmlEntities(String(meta.servicos || '')),
		};

		const result = await createLoja(item);
		if (result.created) {
			stats.imported++;
			console.log('  OK');
		} else if (result.skipped) {
			stats.skipped++;
			console.log(`  SKIPPED: ${result.reason}`);
		} else {
			stats.errors++;
			console.error(`  ERROR: ${result.reason}`);
		}

		await sleep(100);
	}

	console.log();
	console.log('='.repeat(60));
	console.log('  Migration Summary');
	console.log('='.repeat(60));
	console.log(`  Total lojas:  ${stats.total}`);
	console.log(`  Imported:     ${stats.imported}`);
	console.log(`  Skipped:      ${stats.skipped}`);
	console.log(`  Errors:       ${stats.errors}`);
	console.log(`  Images cached: ${importedImageCache.size}`);
	console.log('='.repeat(60));
}

main().catch((err) => {
	console.error('\nFATAL ERROR:', err);
	process.exit(1);
});
