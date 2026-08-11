// Últimos posts do blog.condor.com.br (WordPress).
// O endpoint REST (/wp-json/wp/v2/posts) devolve 500 no servidor deles (plugin quebrado),
// então lemos o RSS feed — que sobrevive — em build time. Fallback de imagem: og:image da página.

export interface BlogPost {
  title: string;
  link: string;
  date: string; // pubDate cru (RFC822); formatado na view com formatDate
  excerpt: string;
  image: string | null;
}

const FEED_URL = 'https://blog.condor.com.br/feed/';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; CondorSite/1.0)' };

/** Conteúdo interno de <tag>...</tag>, removendo CDATA. */
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/** Primeira imagem (jpg/png/webp) encontrada no bloco. */
function firstImage(block: string): string | null {
  const m = block.match(/<img[^>]+src=["']([^"']+?\.(?:jpe?g|png|webp)[^"']*)["']/i);
  return m ? m[1] : null;
}

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function ogImage(url: string): Promise<string | null> {
  try {
    const html = await (await fetch(url, { headers: UA })).text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function getBlogPosts(limit = 4): Promise<BlogPost[]> {
  try {
    const res = await fetch(FEED_URL, { headers: UA });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split('<item>').slice(1, limit + 1).map((s) => s.split('</item>')[0]);

    return await Promise.all(
      items.map(async (item): Promise<BlogPost> => {
        const title = decode(tag(item, 'title'));
        const link = tag(item, 'link');
        const date = tag(item, 'pubDate');
        const image = firstImage(item) ?? (await ogImage(link));
        let excerpt = decode(tag(item, 'description').replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .replace(/O post .*apareceu primeiro em .*/i, '') // rodapé padrão do RSS do WP
          .trim();
        if (excerpt.length > 150) excerpt = excerpt.slice(0, 150).trim() + '…';
        return { title, link, date, excerpt, image };
      }),
    );
  } catch {
    return []; // feed fora do ar no build → seção cai no fallback do Directus
  }
}
