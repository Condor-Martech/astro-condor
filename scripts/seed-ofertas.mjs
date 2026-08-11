// Setup + seed do módulo Ofertas (POC Araucária).
// Cria collections regioes/cidades/tabloides (o MCP do Directus não cria collections),
// adiciona regiao (M2O) em lojas, importa os arquivos reais e seedeia Araucária.
//
// Rodar:  node --env-file=.env scripts/seed-ofertas.mjs
// Idempotente: pode rodar de novo sem duplicar (checa existência antes de criar).

const BASE = (process.env.DIRECTUS_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN ?? '';
if (!BASE || !TOKEN) {
  console.error('DIRECTUS_URL / DIRECTUS_TOKEN ausentes. Rode com: node --env-file=.env scripts/seed-ofertas.mjs');
  process.exit(1);
}

// --- helpers HTTP ------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message ?? text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json?.data ?? json;
}

async function exists(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return res.ok;
}

// --- helpers de schema -------------------------------------------------------
const STATUS_FIELD = {
  field: 'status', type: 'string',
  meta: {
    interface: 'select-dropdown', width: 'half', display: 'labels',
    options: { choices: [
      { text: 'Published', value: 'published' },
      { text: 'Draft', value: 'draft' },
      { text: 'Archived', value: 'archived' },
    ] },
  },
  schema: { default_value: 'published' },
};
const SORT_FIELD = { field: 'sort', type: 'integer', meta: { interface: 'input', hidden: true }, schema: {} };

async function addCollection(name, note, icon) {
  if (await exists(`/collections/${name}`)) { console.log(`= collection ${name} (existe)`); return; }
  await api('POST', '/collections', {
    collection: name,
    meta: { singleton: false, icon, note, sort_field: 'sort' },
    schema: { name },
    fields: [{
      field: 'id', type: 'uuid',
      meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
      schema: { is_primary_key: true, length: 36, has_auto_increment: false },
    }],
  });
  console.log(`+ collection ${name}`);
}

async function addField(collection, spec) {
  if (await exists(`/fields/${collection}/${spec.field}`)) { console.log(`  = ${collection}.${spec.field} (existe)`); return; }
  await api('POST', `/fields/${collection}`, spec);
  console.log(`  + ${collection}.${spec.field}`);
}

async function addM2O(collection, field, related, { required = false, note } = {}) {
  await addField(collection, {
    field, type: 'uuid',
    meta: { interface: 'select-dropdown-m2o', options: { template: '{{nome}}' }, required, note },
    schema: required ? { is_nullable: false } : {},
  });
  try {
    await api('POST', '/relations', {
      collection, field, related_collection: related,
      schema: { on_delete: required ? 'NO ACTION' : 'SET NULL' },
      meta: { sort_field: null },
    });
    console.log(`  + relação ${collection}.${field} → ${related}`);
  } catch (e) {
    if (/exist|unique|already/i.test(e.message)) console.log(`  = relação ${collection}.${field} (existe)`);
    else throw e;
  }
}

async function addFile(collection, field, note) {
  await addField(collection, {
    field, type: 'uuid',
    meta: { interface: field === 'pdf' ? 'file' : 'file-image', special: ['file'], note },
    schema: {},
  });
  try {
    await api('POST', '/relations', {
      collection, field, related_collection: 'directus_files',
      schema: { on_delete: 'SET NULL' }, meta: { sort_field: null },
    });
    console.log(`  + relação ${collection}.${field} → directus_files`);
  } catch (e) {
    if (/exist|unique|already/i.test(e.message)) console.log(`  = relação ${collection}.${field} (existe)`);
    else throw e;
  }
}

// --- helpers de dados --------------------------------------------------------
async function findItem(collection, filter) {
  const q = encodeURIComponent(JSON.stringify(filter));
  const data = await api('GET', `/items/${collection}?filter=${q}&limit=1`);
  return data?.[0] ?? null;
}

async function ensureItem(collection, match, data) {
  const found = await findItem(collection, match);
  if (found) { console.log(`  = ${collection} ${JSON.stringify(match)} (existe)`); return found; }
  const created = await api('POST', `/items/${collection}`, data);
  console.log(`  + ${collection} ${JSON.stringify(match)}`);
  return created;
}

async function importFile(url, title) {
  const file = await api('POST', '/files/import', { url, data: { title } });
  console.log(`  ↑ arquivo importado: ${title} (${file.id})`);
  return file;
}

// --- execução ----------------------------------------------------------------
async function main() {
  console.log(`Directus: ${BASE}\n`);

  // 1) Collections + campos
  await addCollection('regioes', 'Regiões — agrupam cidades. Vídeo/ad por região.', 'map');
  await addField('regioes', STATUS_FIELD);
  await addField('regioes', SORT_FIELD);
  await addField('regioes', { field: 'nome', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } });
  await addField('regioes', { field: 'slug', type: 'string', meta: { interface: 'input', required: true, note: 'Slug explícito (não derivar).' }, schema: { is_nullable: false, is_unique: true } });
  await addField('regioes', { field: 'video_url', type: 'string', meta: { interface: 'input', note: 'Playlist/URL do YouTube (ad por região). Vazio = sem vídeo.' }, schema: {} });
  await addField('regioes', { field: 'descricao', type: 'text', meta: { interface: 'input-multiline' }, schema: {} });

  await addCollection('cidades', 'Cidades — roteiam /ofertas/cidade/{slug} para a região.', 'location_city');
  await addField('cidades', STATUS_FIELD);
  await addField('cidades', SORT_FIELD);
  await addField('cidades', { field: 'nome', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } });
  await addField('cidades', { field: 'slug', type: 'string', meta: { interface: 'input', required: true, note: 'Slug explícito (ex.: ofertas-curitiba, rio-negro-pr).' }, schema: { is_nullable: false, is_unique: true } });
  await addM2O('cidades', 'regiao', 'regioes', { required: true, note: 'Região a que pertence.' });

  await addCollection('tabloides', 'Tabloides (encarte): capa + PDF + validade. Por região.', 'menu_book');
  await addField('tabloides', STATUS_FIELD);
  await addField('tabloides', SORT_FIELD);
  await addField('tabloides', { field: 'titulo', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } });
  await addFile('tabloides', 'capa', 'Capa (thumbnail) do tabloide.');
  await addFile('tabloides', 'pdf', 'Arquivo PDF do tabloide.');
  await addField('tabloides', { field: 'valido_de', type: 'date', meta: { interface: 'datetime', width: 'half' }, schema: {} });
  await addField('tabloides', { field: 'valido_ate', type: 'date', meta: { interface: 'datetime', width: 'half', note: 'Validade — usada na pill e no cron de expiração.' }, schema: {} });
  await addField('tabloides', { field: 'paginas', type: 'integer', meta: { interface: 'input', width: 'half', note: 'Nº de páginas (opcional).' }, schema: {} });
  await addM2O('tabloides', 'regiao', 'regioes', { required: true, note: 'Região do tabloide.' });

  // 2) lojas.regiao (M2O) — opcional (nem toda loja terá região ainda)
  await addM2O('lojas', 'regiao', 'regioes', { required: false, note: 'Região da loja (opcional).' });

  // 3) Seed — regiões + 23 cidades reais + 1 tabloide real
  console.log('\nSeed:');
  const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const parana = await ensureItem('regioes', { slug: 'parana' }, {
    nome: 'Paraná', slug: 'parana', status: 'published', sort: 1, video_url: null,
    descricao: 'Região do Paraná.',
  });
  const scatarina = await ensureItem('regioes', { slug: 'santa-catarina' }, {
    nome: 'Santa Catarina', slug: 'santa-catarina', status: 'published', sort: 2, video_url: null,
    descricao: 'Região de Santa Catarina.',
  });

  // Cidades reais do seletor de /ofertas (23), com sua região.
  const CIDADES_PR = ['Almirante Tamandaré', 'Apucarana', 'Araucária', 'Campo Largo', 'Campo Mourão',
    'Castro', 'Colombo', 'Curitiba', 'Fazenda Rio Grande', 'Lapa', 'Londrina', 'Maringá', 'Paranaguá',
    'Pinhais', 'Piraquara', 'Ponta Grossa', 'Rio Negro', 'São José dos Pinhais'];
  const CIDADES_SC = ['Jaraguá do Sul', 'Joinville', 'Mafra', 'Rio Negrinho', 'São Bento do Sul'];
  const cidades = [
    ...CIDADES_PR.map((nome) => ({ nome, regiao: parana.id })),
    ...CIDADES_SC.map((nome) => ({ nome, regiao: scatarina.id })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  let sort = 1;
  for (const c of cidades) {
    await ensureItem('cidades', { slug: slugify(c.nome) }, {
      nome: c.nome, slug: slugify(c.nome), status: 'published', sort: sort++, regiao: c.regiao,
    });
  }

  const jaTem = await findItem('tabloides', { titulo: { _eq: 'Dia dos Pais' } });
  if (!jaTem) {
    const capa = await importFile('https://institucional.condor.com.br/wp-content/uploads/2024/01/Banner-Tabloide-8.png', 'Capa — Tabloide Dia dos Pais');
    const pdf = await importFile('https://institucional.condor.com.br/wp-content/uploads/2024/01/DIA_DOS_PAIS_28_07_A_09_08_2026_GERAL-PR.pdf', 'Tabloide Dia dos Pais (GERAL-PR)');
    await ensureItem('tabloides', { titulo: { _eq: 'Dia dos Pais' } }, {
      titulo: 'Dia dos Pais', status: 'published', sort: 1,
      capa: capa.id, pdf: pdf.id,
      valido_de: '2026-07-28', valido_ate: '2026-08-09', paginas: null, regiao: parana.id,
    });
  } else {
    console.log('  = tabloides {"titulo":"Dia dos Pais"} (existe)');
  }

  // 4) Atribui lojas de Araucária à região Paraná
  const filtro = encodeURIComponent(JSON.stringify({ cidade: { _icontains: 'arauc' } }));
  const lojas = await api('GET', `/items/lojas?filter=${filtro}&fields=id,nome,cidade,regiao&limit=-1`);
  let n = 0;
  for (const l of lojas) {
    if (l.regiao === parana.id) continue;
    await api('PATCH', `/items/lojas/${l.id}`, { regiao: parana.id });
    n++;
  }
  console.log(`  ~ lojas de Araucária atribuídas à região: ${n} (de ${lojas.length} encontradas)`);

  console.log('\n✓ Pronto.');
}

main().catch((e) => { console.error('\n✗ Erro:', e.message); process.exit(1); });
