const FMT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/** ISO → "05 dez 2023" (pt-BR). Vazio se não houver data. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : FMT.format(d);
}

/** 'YYYY-MM-DD' → 'DD/MM'. Vazio se inválido. Para pill de validade de tabloide. */
export function ddmm(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : '';
}

const CATEGORIAS: Record<string, string> = {
  institucional: 'Institucional',
  'acoes-condor': 'Ações Condor',
  'para-sua-empresa': 'Para sua Empresa',
  'servicos-financeiros': 'Serviços Financeiros',
};

/** Slug de categoria → rótulo legível. Fallback: title-case do slug. */
export function labelCategoria(cat: string | null | undefined): string {
  if (!cat) return '';
  return CATEGORIAS[cat] ?? cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const DESCRICOES: Record<string, string> = {
  institucional:
    'Nossa história, estrutura e os valores que fazem da Condor a rede mais amada dos paranaenses.',
  'servicos-financeiros':
    'Formas de pagamento, benefícios e serviços que facilitam o seu dia a dia na Condor.',
  'acoes-condor':
    'Educação, cultura, esporte e sustentabilidade: as iniciativas que a Condor leva para a comunidade.',
  'para-sua-empresa':
    'Cartões e soluções corporativas para o seu negócio comprar melhor na Condor.',
};

/** Descrição de apoio da categoria (subtítulo do hero). Vazio se não houver. */
export function descricaoCategoria(cat: string | null | undefined): string {
  if (!cat) return '';
  return DESCRICOES[cat] ?? '';
}
