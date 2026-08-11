// Tipos do schema real do Directus (verificado via MCP). Modelo plano, sem M2M.

export type Status = 'published' | 'draft' | 'archived';

export interface HeroSlide {
  id: string;
  title: string; // headline — usado como alt do banner
  url: string | null; // link do banner
  image_desktop: string | null; // file id
  image_mobile: string | null; // file id
  data_inicio: string | null; // 'YYYY-MM-DD' — início da vigência
  data_fim: string | null; // 'YYYY-MM-DD' — fim da vigência
}

export interface Banner {
  id: string;
  position: string; // slot: 'home-meio', etc.
  alt: string;
  imagem: string | null; // file id (desktop)
  imagem_mobile: string | null; // file id (opcional)
  url: string | null;
  target: '_self' | '_blank' | null;
}

export interface CardHome {
  id: string;
  title: string;
  url: string | null;
  image: string | null; // file id
}

export interface Loja {
  id: string;
  nome: string;
  slug: string;
  cidade: string | null;
  telefone: string | null;
  link_maps: string | null;
  latitude: string | null;
  longitude: string | null;
  image: string | null; // file id
  horarios: string | null; // HTML
  setores: string | null; // CSV
  servicos: string | null; // CSV
  regiao?: string | null; // regiao id (M2O)
}

export interface Regiao {
  id: string;
  nome: string;
  slug: string;
  video_url: string | null; // playlist/URL do YouTube — ad por região
  descricao: string | null;
}

export interface Cidade {
  id: string;
  nome: string;
  slug: string; // explícito (ex.: ofertas-curitiba, rio-negro-pr) — nunca derivar
  regiao: Regiao | null; // M2O — expandido em getCidadesFull
}

export interface Tabloide {
  id: string;
  titulo: string;
  capa: string | null; // file id — thumbnail
  pdf: string | null; // file id — encarte
  valido_de: string | null; // 'YYYY-MM-DD'
  valido_ate: string | null; // 'YYYY-MM-DD'
  paginas: number | null;
  regiao: string | null; // regiao id (M2O não expandido)
}

// Carrossel de ofertas: cada linha = uma campanha (lote de imagens) com vigência, por região.
export interface CarroselOferta {
  id: string;
  regiao: string | null; // regiao id (M2O não expandido)
  data_inicio: string | null; // 'YYYY-MM-DD' — vazio = sem limite
  data_fim: string | null; // 'YYYY-MM-DD' — vazio = sem limite
  imagens: { directus_files_id: string }[]; // M2M via junction carrosel_ofertas_files_1 (ordem = ordem de inserção)
}

export interface Noticia {
  id: string;
  titulo: string;
  slug: string;
  data_publicacao: string | null; // ISO
  resumo: string | null;
  content: string | null; // HTML
  image: string | null; // file id
}

export interface Page {
  id: string;
  titulo: string;
  slug: string;
  categoria: string | null;
  image: string | null; // file id
  content: string | null; // HTML
  seo: PageSeo | null;
  exibir_no_hub?: boolean; // toggle: aparece no hub /institucional (default true)
}

export type TipoPublicacao = 'livro' | 'relatorio' | 'link';

export interface Publicacao {
  id: string;
  titulo: string;
  tipo: TipoPublicacao | null;
  imagem: string | null; // file id — capa
  arquivo: string | null; // file id — PDF para download
  url: string | null; // link (interno ou externo)
  descricao: string | null;
  externo?: boolean; // link/relatorio: externo (rel noopener) ou interno. Default true.
  target?: '_self' | '_blank' | null; // link/relatorio: nova aba (_blank) ou mesma (_self)
}

export interface PageSeo {
  title?: string;
  meta_description?: string;
  og_image?: string;
  [key: string]: unknown;
}

export interface Global {
  logo: string | null; // file id
  favicon: string | null; // file id
  seo: PageSeo | null;
  topbar_ativo: boolean; // liga a faixa de anúncio no topo
  topbar_texto: string | null; // texto curto da faixa
  topbar_url: string | null; // link da faixa
  topbar_cor_fundo: string | null; // cor de fundo da faixa (hex)
  topbar_cor_texto: string | null; // cor do texto da faixa (hex)
  ofertas_disclaimer: string | null; // texto legal do rodapé das páginas de ofertas por cidade
}

/** Singleton `integracoes` — tags/códigos de terceiros. Acesso restrito (não expor a editores). */
export interface Integracoes {
  gtm_id: string | null; // Google Tag Manager container (GTM-XXXXXX)
  emarsys_merchant_id: string | null; // Emarsys Web Extend (Scarab) merchant ID
  head_code: string | null; // código bruto no <head> — SEM cookies (SEO, verificação, JSON-LD)
  body_code: string | null; // código bruto no início do <body> — SEM cookies
  analytics_code: string | null; // tracking analítico — só com consentimento 'analiticos'
  marketing_code: string | null; // tracking de marketing — só com consentimento 'marketing'
}

export interface ModalHome {
  ativo: boolean;
  titulo: string | null;
  descricao: string | null; // texto abaixo da imagem
  url: string | null; // link do CTA (interno /... ou externo https://...)
  cta_label: string | null; // texto do botão (fallback 'Confira')
  cta_cor: string | null; // cor do botão (fallback vermelho da marca)
  imagem: string | null; // file id
  data_inicio: string | null; // 'YYYY-MM-DD' — início da vigência
  data_fim: string | null; // 'YYYY-MM-DD' — fim da vigência
}

export interface RedeSocial {
  id: number;
  label: string;
  url: string;
  icon: string | null;
}

export type MenuPosition = 'header' | 'bottom-1' | 'bottom-2' | 'bottom-3';

export interface MenuItem {
  id: string;
  label: string;
  url: string | null;
  target: '_self' | '_blank' | null;
  parent: string | null;
  children?: MenuItem[];
}

export interface DirectusSchema {
  global: Global; // singleton
  integracoes: Integracoes; // singleton (tags/códigos técnicos)
  modal_home: ModalHome; // singleton
  hero_slides: HeroSlide[];
  banners: Banner[];
  card_home: CardHome[];
  lojas: Loja[];
  noticias: Noticia[];
  pages: Page[];
  publicacoes: Publicacao[];
  redes_sociais: RedeSocial[];
  menu_items: MenuItem[];
  regioes: Regiao[];
  cidades: Cidade[];
  tabloides: Tabloide[];
}

/** Divide um campo CSV do Directus em lista limpa (setores/servicos). */
export function splitCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
