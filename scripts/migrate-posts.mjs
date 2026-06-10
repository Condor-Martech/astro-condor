/**
 * WordPress to Directus Migration Script
 *
 * Migrates ALL published posts from WordPress (institucional.condor.com.br)
 * into Directus `noticias` collection, including featured images and
 * internal content images.
 *
 * Usage:
 *   DIRECTUS_TOKEN=your_token node scripts/migrate-posts.mjs
 *
 * Or create a .env file in the project root with:
 *   DIRECTUS_TOKEN=your_token
 *   DIRECTUS_URL=http://localhost:8055  (optional)
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
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found — that's fine
  }
}

loadEnv();

const WP_BASE = 'https://institucional.condor.com.br/wp-json/wp/v2';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';

if (!DIRECTUS_TOKEN) {
  console.warn('\n⚠  DIRECTUS_TOKEN not set. Requests will be sent without auth — this may fail.\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function directusHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (DIRECTUS_TOKEN) {
    headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

/**
 * HTML entity decoder (handles the common ones WordPress emits).
 */
function decodeHtmlEntities(str) {
  const map = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#039;': "'", '&#8217;': '\u2019', '&#8216;': '\u2018',
    '&#8220;': '\u201C', '&#8221;': '\u201D', '&#8211;': '\u2013',
    '&#8212;': '\u2014', '&nbsp;': ' ', '&#8230;': '\u2026',
    '&aacute;': '\u00E1', '&eacute;': '\u00E9', '&iacute;': '\u00ED',
    '&oacute;': '\u00F3', '&uacute;': '\u00FA', '&atilde;': '\u00E3',
    '&otilde;': '\u00F5', '&ccedil;': '\u00E7', '&Aacute;': '\u00C1',
    '&Eacute;': '\u00C9', '&Iacute;': '\u00CD', '&Oacute;': '\u00D3',
    '&Uacute;': '\u00DA', '&Atilde;': '\u00C3', '&Otilde;': '\u00D5',
    '&Ccedil;': '\u00C7',
  };
  let result = str;
  for (const [entity, char] of Object.entries(map)) {
    result = result.replaceAll(entity, char);
  }
  // Numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

/**
 * Strip dangerous tags WITH their content (scripts, iframes, styles, etc.)
 * and obfuscated payload patterns commonly injected by WordPress malware.
 * Must run BEFORE any tag-stripping that only removes brackets.
 */
function sanitizeDangerous(html) {
  let s = html;

  // Tags whose CONTENT must also be removed (not just the brackets)
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  s = s.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
  s = s.replace(/<embed\b[^>]*\/?>/gi, '');
  s = s.replace(/<applet\b[^>]*>[\s\S]*?<\/applet>/gi, '');

  // Orphaned obfuscated payloads (defense-in-depth, in case the malware
  // is emitted as plain text by a buggy WP plugin or sanitizer)
  // Hex-encoded strings: \x68\x74\x74... or x68x74x74...
  s = s.replace(/(?:\\?x[0-9a-fA-F]{2}){6,}/g, '');
  // Obfuscated identifiers: _0x4a3f, _0x9e23
  s = s.replace(/_0x[0-9a-fA-F]{3,}/g, '');
  // javascript: hrefs/srcs
  s = s.replace(/(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"');
  // Inline event handlers (onclick, onload, onerror, etc.)
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');

  return s;
}

/**
 * Strip all HTML tags and return plain text, trimmed.
 * Runs sanitizeDangerous first so the inner JS code does not leak into excerpts.
 */
function stripHtml(html) {
  return sanitizeDangerous(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Clean Elementor wrapper divs from content, keeping only semantic HTML.
 */
function cleanContent(html) {
  // CRITICAL: sanitize injected malware payloads FIRST, before any other
  // tag manipulation. Without this, <script>...</script> contents leak as plain text.
  let content = sanitizeDangerous(html);

  // Remove Elementor data attributes and wrapper divs
  // Strategy: iteratively strip outer non-semantic wrappers

  // Remove <div> tags with data-elementor attributes
  content = content.replace(/<div[^>]*\bdata-elementor[^>]*>/gi, '');

  // Remove <div> tags with elementor classes
  content = content.replace(/<div[^>]*\bclass="[^"]*elementor[^"]*"[^>]*>/gi, '');

  // Remove <section> tags with elementor classes
  content = content.replace(/<section[^>]*\bclass="[^"]*elementor[^"]*"[^>]*>/gi, '');
  content = content.replace(/<\/section>/gi, '');

  // Remove <div> tags with data-id, data-element_type, data-settings attributes (Elementor patterns)
  content = content.replace(/<div[^>]*\bdata-id="[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div[^>]*\bdata-element_type="[^"]*"[^>]*>/gi, '');

  // Remove generic non-semantic <div> open/close tags that remain
  // Keep only allowed tags
  const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i',
    'a', 'ul', 'ol', 'li', 'img', 'blockquote', 'br', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'sup', 'sub'];

  const allowedSet = new Set(allowedTags);

  // Remove all tags that are NOT in the allowed list
  content = content.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
    if (allowedSet.has(tagName.toLowerCase())) {
      return match;
    }
    return '';
  });

  // Strip empty paragraphs
  content = content.replace(/<p[^>]*>\s*<\/p>/gi, '');

  // Strip multiple consecutive newlines / whitespace runs
  content = content.replace(/(\r?\n){3,}/g, '\n\n');

  return content.trim();
}

// ---------------------------------------------------------------------------
// WordPress API
// ---------------------------------------------------------------------------

/**
 * Fetch ALL published posts from WordPress, paginating automatically.
 */
async function fetchAllWpPosts() {
  const perPage = 100;
  let page = 1;
  let allPosts = [];

  console.log('Fetching posts from WordPress...');

  while (true) {
    const url = `${WP_BASE}/posts?status=publish&per_page=${perPage}&page=${page}` +
      `&_fields=id,title,slug,date,featured_media,excerpt,content`;

    const res = await fetch(url);

    if (!res.ok) {
      // Page out of range returns 400
      if (res.status === 400) break;
      throw new Error(`WP API error: ${res.status} ${res.statusText}`);
    }

    const posts = await res.json();
    if (!posts.length) break;

    allPosts = allPosts.concat(posts);
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    console.log(`  Page ${page}/${totalPages} — fetched ${posts.length} posts (total so far: ${allPosts.length})`);

    if (page >= totalPages) break;
    page++;
    await sleep(100);
  }

  console.log(`Total WordPress posts fetched: ${allPosts.length}\n`);
  return allPosts;
}

// ---------------------------------------------------------------------------
// Image handling
// ---------------------------------------------------------------------------

/** Cache: WP media ID -> source_url */
const mediaUrlCache = new Map();

/** Cache: image source URL -> Directus file UUID */
const importedImageCache = new Map();

/**
 * Resolve a WordPress media ID to its source URL.
 */
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

/**
 * Import an image URL into Directus and return the file UUID.
 * Uses cache to avoid re-importing the same URL.
 */
async function importImageToDirectus(imageUrl, title = '') {
  if (importedImageCache.has(imageUrl)) return importedImageCache.get(imageUrl);

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
      throw new Error(`Status ${res.status}: ${body}`);
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

/**
 * Find all internal WordPress image URLs in content HTML,
 * import them to Directus, and replace URLs in content.
 */
async function processContentImages(content) {
  // Match src attributes pointing to condor uploads
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

/**
 * Create a noticia item in Directus.
 * Returns { created: true } or { skipped: true, reason } or { error: true, reason }.
 */
async function createNoticia(item) {
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/noticias`, {
      method: 'POST',
      headers: directusHeaders(),
      body: JSON.stringify(item),
    });

    if (res.ok) return { created: true };

    if (res.status === 409) {
      return { skipped: true, reason: 'Already exists (409 conflict)' };
    }

    // Check for unique constraint violations in different Directus versions
    const body = await res.text();
    if (body.includes('UNIQUE') || body.includes('unique') || body.includes('duplicate')) {
      return { skipped: true, reason: `Duplicate detected: ${body.slice(0, 120)}` };
    }

    return { error: true, reason: `HTTP ${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { error: true, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('  WordPress -> Directus Migration');
  console.log(`  WP Source:  ${WP_BASE}`);
  console.log(`  Directus:   ${DIRECTUS_URL}`);
  console.log(`  Auth:       ${DIRECTUS_TOKEN ? 'Bearer token set' : 'NO TOKEN'}`);
  console.log('='.repeat(60));
  console.log();

  const posts = await fetchAllWpPosts();
  if (!posts.length) {
    console.log('No posts to migrate. Done.');
    return;
  }

  const stats = { total: posts.length, imported: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const title = decodeHtmlEntities(post.title.rendered);
    console.log(`[${i + 1}/${posts.length}] Importing: ${title}`);

    // --- Featured image ---
    let featuredImageId = null;
    if (post.featured_media > 0) {
      const mediaUrl = await getWpMediaUrl(post.featured_media);
      if (mediaUrl) {
        featuredImageId = await importImageToDirectus(mediaUrl, title);
        if (featuredImageId) {
          console.log(`  Featured image imported: ${featuredImageId}`);
        }
        await sleep(100);
      }
    }

    // --- Content: process internal images ---
    let content = post.content.rendered || '';
    content = await processContentImages(content);

    // --- Content: clean Elementor wrappers ---
    content = cleanContent(content);

    // --- Excerpt ---
    const rawExcerpt = stripHtml(decodeHtmlEntities(post.excerpt.rendered || ''));
    const resumo = rawExcerpt.length > 300 ? rawExcerpt.slice(0, 297) + '...' : rawExcerpt;

    // --- Build Directus item ---
    const item = {
      titulo: title,
      slug: post.slug,
      resumo,
      content,
      image: featuredImageId,
      data_publicacao: post.date,
      status: 'published',
    };

    const result = await createNoticia(item);

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

  // --- Summary ---
  console.log();
  console.log('='.repeat(60));
  console.log('  Migration Summary');
  console.log('='.repeat(60));
  console.log(`  Total posts:  ${stats.total}`);
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
