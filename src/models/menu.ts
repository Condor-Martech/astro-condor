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

import { fetchDirectus } from '../lib/directus';

export interface MenuWithMeta {
  name: string;
  items: Menu[];
}

async function fetchMenuByPosition(position: string): Promise<DirectusMenu | null> {
  const fields = [
    'id', 'name', 'position',
    'items.id', 'items.label', 'items.url', 'items.target',
    'items.sort', 'items.status', 'items.parent',
    'items.children.id', 'items.children.label', 'items.children.url',
    'items.children.target', 'items.children.sort', 'items.children.status',
  ].join(',');

  const menus = await fetchDirectus<DirectusMenu>(
    `/items/menus?filter[position][_eq]=${position}&filter[status][_eq]=published&fields=${fields}&limit=1`
  );

  return menus[0] ?? null;
}

export async function getMenuByPosition(position: string): Promise<Menu[]> {
  const menu = await fetchMenuByPosition(position);
  if (!menu?.items) return [];
  return mapItems(menu.items);
}

export async function getMenuMetaByPosition(position: string): Promise<MenuWithMeta | null> {
  const menu = await fetchMenuByPosition(position);
  if (!menu) return null;
  return {
    name: menu.name,
    items: menu.items ? mapItems(menu.items) : [],
  };
}
