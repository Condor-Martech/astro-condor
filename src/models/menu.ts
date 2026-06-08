export interface MenuItem {
  label: string;
  href: string;
  target?: string;
}

export interface Menu {
  label: string;
  href: string;
  children?: MenuItem[];
}

interface DirectusMenuItem {
  id: string;
  label: string;
  url: string;
  target: string;
  sort: number;
  status: string;
  parent: string | null;
  children?: DirectusMenuItem[];
}

interface DirectusMenu {
  id: string;
  name: string;
  position: string;
  items: DirectusMenuItem[];
}

function mapItems(items: DirectusMenuItem[]): Menu[] {
  const rootItems = items
    .filter((item) => item.status === 'published' && item.parent === null)
    .sort((a, b) => a.sort - b.sort);

  return rootItems.map((item) => {
    const children = item.children
      ?.filter((child) => child.status === 'published')
      .sort((a, b) => a.sort - b.sort)
      .map((child) => ({
        label: child.label,
        href: child.url,
        target: child.target === '_blank' ? ('_blank' as const) : undefined,
      }));

    return {
      label: item.label,
      href: item.url,
      ...(children && children.length > 0 ? { children } : {}),
    };
  });
}

export async function getMenuByPosition(position: string): Promise<Menu[]> {
  const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'http://localhost:8055';
  const DIRECTUS_TOKEN = import.meta.env.DIRECTUS_TOKEN;

  const fields = [
    'id', 'name', 'position',
    'items.id', 'items.label', 'items.url', 'items.target',
    'items.sort', 'items.status', 'items.parent',
    'items.children.id', 'items.children.label', 'items.children.url',
    'items.children.target', 'items.children.sort', 'items.children.status',
  ].join(',');

  const url = `${DIRECTUS_URL}/items/menus?filter[position][_eq]=${position}&filter[status][_eq]=published&fields=${fields}&limit=1`;

  const headers: Record<string, string> = {};
  if (DIRECTUS_TOKEN) {
    headers['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  const { data } = await res.json() as { data: DirectusMenu[] };

  if (!data || data.length === 0) return [];

  return mapItems(data[0].items);
}
