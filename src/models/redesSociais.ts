import { fetchDirectus } from '../lib/directus';

export interface RedeSocial {
  label: string;
  url: string;
  icon: string;
}

interface DirectusRedeSocial {
  id: number;
  status: string;
  sort: number;
  label: string;
  url: string;
  icon: string;
}

export async function getRedesSociais(): Promise<RedeSocial[]> {
  const items = await fetchDirectus<DirectusRedeSocial>(
    '/items/redes_sociais?filter[status][_eq]=published&fields=id,label,url,icon,sort&sort=sort&limit=-1'
  );

  return items.map((item) => ({
    label: item.label,
    url: item.url,
    icon: item.icon,
  }));
}
