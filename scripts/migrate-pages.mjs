/**
 * WordPress Pages -> Directus `pages` Migration
 *
 * Migrates institutional pages (Elementor-built) from
 * institucional.condor.com.br into the Directus `pages` collection,
 * preserving the hub/category structure used by [slug].astro.
 *
 * Mapping rules:
 *   - Top-level WP page (parent=0) whose slug is in ALLOWED_HUBS
 *       => migrated as HUB (categoria === slug)
 *   - Child WP page whose parent is an allowed hub
 *       => migrated with categoria = parent slug
 *   - Anything else (autoposto subtree, home, lojas, ofertas, etc.)
 *       => skipped
 *
 * Image handling:
 *   - WP Elementor pages have no featured_media. The first <img>
 *     in the content is extracted, imported to Directus, used as
 *     the page banner (`image` field) and REMOVED from the content
 *     to avoid showing it twice.
 *   - Remaining images in the content are imported to Directus and
 *     their URLs are rewritten to point at /assets/{id}.
 *
 * Existing rows in Directus are SKIPPED (no overwrite). Re-run after
 * deleting the row if you want to re-import.
 *
 * Usage:
 *   DIRECTUS_TOKEN=... node scripts/migrate-pages.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config
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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found — fine
  }
}

loadEnv();

const WP_BASE = 'https://institucional.condor.com.br/wp-json/wp/v2';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const DRY_RUN = process.argv.includes('--dry-run');

if (!DIRECTUS_TOKEN && !DRY_RUN) {
  console.warn('\n⚠  DIRECTUS_TOKEN not set. Requests will be sent without auth.\n');
}

// Top-level WP slugs that map to Directus categorias (hubs)
const ALLOWED_HUBS = new Set([
  'institucional',
  'acoes-condor',
  'servicos-financeiros',
  'para-sua-empresa',
]);

// Slugs to skip even if inside an allowed subtree:
//   noticias, lojas, ofertas → already have dedicated Astro routes / collections
//   home                    → handled by /index.astro
//   autoposto               → entire subtree excluded by user decision
const EXCLUDED_SLUGS = new Set([
  'home',
  'noticias',
  'lojas',
  'ofertas',
  'autoposto',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function directusHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (DIRECTUS_TOKEN) headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

function decodeHtmlEntities(str) {
  const map = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#039;': "'", '&#8217;': '’', '&#8216;': '‘',
    '&#8220;': '“', '&#8221;': '”', '&#8211;': '–',
    '&#8212;': '—', '&nbsp;': ' ', '&#8230;': '…',
    '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í',
    '&oacute;': 'ó', '&uacute;': 'ú', '&atilde;': 'ã',
    '&otilde;': 'õ', '&ccedil;': 'ç', '&Aacute;': 'Á',
    '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó',
    '&Uacute;': 'Ú', '&Atilde;': 'Ã', '&Otilde;': 'Õ',
    '&Ccedil;': 'Ç',
  };
  let result = str;
  for (const [entity, char] of Object.entries(map)) {
    result = result.replaceAll(entity, char);
  }
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

function sanitizeDangerous(html) {
  let s = html;
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

/**
 * Strip Elementor wrappers, keep only semantic HTML.
 */
function cleanContent(html) {
  let content = sanitizeDangerous(html);

  content = content.replace(/<div[^>]*\bdata-elementor[^>]*>/gi, '');
  content = content.replace(/<div[^>]*\bclass="[^"]*elementor[^"]*"[^>]*>/gi, '');
  content = content.replace(/<section[^>]*\bclass="[^"]*elementor[^"]*"[^>]*>/gi, '');
  content = content.replace(/<\/section>/gi, '');
  content = content.replace(/<div[^>]*\bdata-id="[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div[^>]*\bdata-element_type="[^"]*"[^>]*>/gi, '');

  const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i',
    'a', 'ul', 'ol', 'li', 'img', 'blockquote', 'br', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'sup', 'sub'];
  const allowedSet = new Set(allowedTags);

  content = content.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
    return allowedSet.has(tagName.toLowerCase()) ? match : '';
  });

  content = content.replace(/<p[^>]*>\s*<\/p>/gi, '');
  content = content.replace(/(\r?\n){3,}/g, '\n\n');

  return content.trim();
}

/**
 * Extract the first <img> from a chunk of HTML.
 * Returns { src, html } where html has that single <img> removed.
 *
 * Note: `\bsrc="` cannot match `srcset="` because of the literal `=`,
 * so this matches the real src attribute even if srcset appears later.
 */
function extractFirstImage(html) {
  const re = /<img\b[^>]*\bsrc="([^"]+)"[^>]*\/?>/i;
  const m = html.match(re);
  if (!m) return { src: null, html };
  return { src: m[1], html: html.replace(m[0], '') };
}

// ---------------------------------------------------------------------------
// WordPress API
// ---------------------------------------------------------------------------

async function fetchAllWpPages() {
  const perPage = 100;
  let page = 1;
  let all = [];

  console.log('Fetching pages from WordPress...');

  while (true) {
    const url = `${WP_BASE}/pages?status=publish&per_page=${perPage}&page=${page}` +
      `&_fields=id,title,slug,content,parent,date,modified`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status} ${res.statusText}`);
    }
    const items = await res.json();
    if (!items.length) break;
    all = all.concat(items);
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    console.log(`  Page ${page}/${totalPages} — fetched ${items.length} (total so far: ${all.length})`);
    if (page >= totalPages) break;
    page++;
    await sleep(100);
  }

  console.log(`Total WP pages fetched: ${all.length}\n`);
  return all;
}

// ---------------------------------------------------------------------------
// Image import
// ---------------------------------------------------------------------------

const importedImageCache = new Map();

async function importImageToDirectus(imageUrl, title = '') {
  if (importedImageCache.has(imageUrl)) return importedImageCache.get(imageUrl);

  if (DRY_RUN) {
    const fakeId = `dry-${importedImageCache.size + 1}`;
    importedImageCache.set(imageUrl, fakeId);
    console.log(`  [DRY] would import image: ${imageUrl}`);
    return fakeId;
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/files/import`, {
      method: 'POST',
      headers: directusHeaders(),
      body: JSON.stringify({
        url: imageUrl,
        data: {
          title: title || imageUrl.split('/').pop(),
          description: title || '',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Status ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const fileId = data.data.id;
    importedImageCache.set(imageUrl, fileId);
    return fileId;
  } catch (err) {
    console.error(`  [WARN] Failed to import image ${imageUrl}: ${err.message}`);
    return null;
  }
}

async function processContentImages(content) {
  const regex = /src="(https?:\/\/institucional\.condor\.com\.br\/wp-content\/uploads\/[^"]+)"/g;
  const matches = [...content.matchAll(regex)];
  if (!matches.length) return content;

  let processed = content;
  const uniqueUrls = [...new Set(matches.map((m) => m[1]))];
  for (const url of uniqueUrls) {
    const fileId = await importImageToDirectus(url);
    if (fileId) {
      const directusAssetUrl = `${DIRECTUS_URL}/assets/${fileId}`;
      processed = processed.replaceAll(url, directusAssetUrl);
    }
    await sleep(100);
  }
  return processed;
}

// ---------------------------------------------------------------------------
// Directus
// ---------------------------------------------------------------------------

async function createPage(item) {
  if (DRY_RUN) {
    console.log(`  [DRY] would POST /items/pages → titulo="${item.titulo}" slug="${item.slug}" categoria="${item.categoria}" image=${item.image || 'null'} content=${item.content.length}ch`);
    return { created: true };
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/items/pages`, {
      method: 'POST',
      headers: directusHeaders(),
      body: JSON.stringify(item),
    });

    if (res.ok) return { created: true };

    if (res.status === 409) {
      return { skipped: true, reason: 'Already exists (409)' };
    }

    const body = await res.text();
    if (body.includes('UNIQUE') || body.includes('unique') || body.includes('duplicate')) {
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

function buildExcludedTree(allPages, rootSlug) {
  const excluded = new Set();
  const root = allPages.find((p) => p.slug === rootSlug);
  if (!root) return excluded;
  excluded.add(root.id);
  let queue = [root.id];
  while (queue.length) {
    const parentId = queue.shift();
    for (const p of allPages) {
      if (p.parent === parentId && !excluded.has(p.id)) {
        excluded.add(p.id);
        queue.push(p.id);
      }
    }
  }
  return excluded;
}

function selectPagesToMigrate(allPages) {
  const idToSlug = new Map(allPages.map((p) => [p.id, p.slug]));
  const autopostoTree = buildExcludedTree(allPages, 'autoposto');

  const selected = [];
  for (const page of allPages) {
    if (EXCLUDED_SLUGS.has(page.slug)) continue;
    if (autopostoTree.has(page.id)) continue;

    let categoria = null;
    if (page.parent === 0) {
      if (!ALLOWED_HUBS.has(page.slug)) continue;
      categoria = page.slug; // hub: slug === categoria
    } else {
      const parentSlug = idToSlug.get(page.parent);
      if (!parentSlug || !ALLOWED_HUBS.has(parentSlug)) continue;
      categoria = parentSlug;
    }

    selected.push({ ...page, _categoria: categoria });
  }
  return selected;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  WordPress Pages -> Directus `pages` Migration');
  console.log(`  WP Source:  ${WP_BASE}`);
  console.log(`  Directus:   ${DIRECTUS_URL}`);
  console.log(`  Auth:       ${DIRECTUS_TOKEN ? 'Bearer token set' : 'NO TOKEN'}`);
  console.log(`  Mode:       ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will write to Directus)'}`);
  console.log('='.repeat(60));
  console.log();

  const allPages = await fetchAllWpPages();
  if (!allPages.length) {
    console.log('No pages to migrate. Done.');
    return;
  }

  const toMigrate = selectPagesToMigrate(allPages);

  console.log(`Eligible pages: ${toMigrate.length} (of ${allPages.length} total)`);
  console.log('Plan:');
  const byCategoria = toMigrate.reduce((acc, p) => {
    (acc[p._categoria] ||= []).push(p.slug);
    return acc;
  }, {});
  for (const [cat, slugs] of Object.entries(byCategoria)) {
    console.log(`  [${cat}] ${slugs.length} pages: ${slugs.join(', ')}`);
  }
  console.log();

  const stats = { total: toMigrate.length, imported: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < toMigrate.length; i++) {
    const page = toMigrate[i];
    const title = decodeHtmlEntities(page.title.rendered);
    const isHub = page.slug === page._categoria;
    console.log(`[${i + 1}/${toMigrate.length}] ${isHub ? 'HUB' : '   '} ${page._categoria}/${page.slug} — ${title}`);

    let content = page.content.rendered || '';

    // 1. Banner: extract first <img>, import to Directus, strip from content.
    //    Skip WP "sem-imagem" placeholders — strip them from content but keep banner null.
    let bannerId = null;
    const { src: bannerSrc, html: contentWithoutBanner } = extractFirstImage(content);
    if (bannerSrc) {
      const isPlaceholder = /sem-imagem/i.test(bannerSrc);
      if (isPlaceholder) {
        content = contentWithoutBanner;
        console.log(`  Banner skipped (placeholder): ${bannerSrc.split('/').pop()}`);
      } else {
        bannerId = await importImageToDirectus(bannerSrc, title);
        if (bannerId) {
          console.log(`  Banner imported: ${bannerId}`);
          content = contentWithoutBanner;
          await sleep(100);
        }
        // if import failed, leave the <img> in content (fall through)
      }
    }

    // 2. Process remaining embedded images
    content = await processContentImages(content);

    // 3. Clean Elementor wrappers
    content = cleanContent(content);

    // 4. Build Directus item
    const item = {
      titulo: title,
      slug: page.slug,
      categoria: page._categoria,
      content,
      image: bannerId,
      status: 'published',
    };

    const result = await createPage(item);

    if (result.created) {
      stats.imported++;
      console.log(`  OK`);
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
  console.log(`  Total eligible: ${stats.total}`);
  console.log(`  Imported:       ${stats.imported}`);
  console.log(`  Skipped:        ${stats.skipped}`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log(`  Images cached:  ${importedImageCache.size}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
