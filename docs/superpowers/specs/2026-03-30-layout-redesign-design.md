# Layout Redesign — Condor Institucional (WordPress → Astro)

## Objetivo

Migrar el sitio institucional de Condor (https://institucional.condor.com.br) de WordPress a Astro, comenzando por el layout (header + footer). El rediseño busca una estética **premium/sofisticada** manteniendo la identidad visual de Condor, con enfoque **mobile-first**.

## Stack Técnico

- **Astro** — Framework principal, SSG
- **Tailwind CSS** — Estilos, mobile-first
- **Framer Motion** — Animaciones puntuales (React islands via Astro)
- **React** — Solo para componentes con animación (islands architecture)
- **Sin JS innecesario** — El layout estático no carga JS; solo los islands interactivos

## Paleta de Colores

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#0A0F1E` | Fondo header, footer |
| `--bg-darker` | `#070B15` | Copyright bar |
| `--border-subtle` | `#1A2035` | Separadores |
| `--accent-red` | `#E30613` | CTAs, hovers, acentos |
| `--text-primary` | `#FFFFFF` | Texto principal sobre fondos oscuros |
| `--text-nav` | `#F0F0F0` | Links de navegación |
| `--text-secondary` | `#9CA3AF` | Links footer, texto secundario |
| `--text-muted` | `#6B7280` | Copyright, metadata |

## Header

### Estructura

El header actual tiene 3 niveles (top bar + logo + nav). Se reduce a **1 nivel** con:

- **Logo** a la izquierda
- **Navegación** al centro
- **CTA** a la derecha (ej: "Condor em Casa" como botón destacado)

### Navegación Reorganizada

De 9 items sueltos a **5 items** con dropdowns:

| Item | Tipo | Contenido |
|------|------|-----------|
| Empresa | Dropdown | Nossa história, Nossa estrutura, Fundador, Prêmios, ESG, Notícias |
| Lojas | Link directo | → /lojas |
| Ofertas | Link directo | → /ofertas |
| Serviços | Dropdown | Auto Posto, Z-ON, Condor em Casa, Serviços Financeiros |
| Contato | Dropdown | Fale Conosco, Trabalhe Conosco, SAC |

### Comportamiento Sticky

- **Estado inicial:** Fondo sólido `#0A0F1E`, padding generoso
- **En scroll (>50px):** Se compacta (reduce padding), gana efecto **glassmorphism** (backdrop-blur + fondo semi-transparente). Transición suave via Framer Motion
- **Sticky permanente:** No se oculta al hacer scroll down

### Dropdowns

- Aparecen con animación Framer Motion (fade + slide down sutil)
- Fondo `#0A0F1E` con borde sutil `#1A2035`
- Items con hover que transiciona a blanco + underline animado rojo

### Mobile (< 768px)

- **Logo** a la izquierda, **hamburger icon** a la derecha
- Al abrir: **Drawer full-screen** con animación Framer Motion (slide desde la derecha)
- Fondo `#0A0F1E` opaco
- Items de nav apilados verticalmente, dropdowns como acordeones
- Botón de cierre (X) en la esquina superior derecha

## Footer

### Estructura — 3 Zonas

#### Zona 1: Footer Principal

Grid de **4 columnas** (en mobile se apilan verticalmente):

| Columna 1 | Columna 2 | Columna 3 | Columna 4 |
|-----------|-----------|-----------|-----------|
| Logo Condor (versión blanca) | **Institucional** | **Serviços** | **Contato** |
| Breve tagline | Nossa história | Auto Posto | 0800 416655 |
| Iconos redes sociales | Nossa estrutura | Z-ON | Trabalhe Conosco |
| | Prêmios | Condor em Casa | SAC |
| | ESG | Ofertas | Política de Privacidade |
| | Notícias | Clube Condor | |

#### Zona 2: Separador

Línea horizontal sutil color `#1A2035`.

#### Zona 3: Copyright Bar

- Fondo `#070B15`
- Texto: "© 2026 Condor — Todos os direitos reservados"
- Color texto: `#6B7280`
- Tamaño: pequeño (text-sm)

### Interacciones Footer

- Links: color base `#9CA3AF` → hover `#FFFFFF` con underline animado
- Iconos redes sociales: color base `#9CA3AF` → hover muestra color de cada red:
  - Facebook → `#1877F2`
  - Instagram → gradiente rosa/naranja
  - X/Twitter → `#FFFFFF`
  - YouTube → `#FF0000`
  - LinkedIn → `#0A66C2`
  - TikTok → `#00F2EA`

## Componentes Astro

### Archivos del Layout

```
src/
├── layouts/
│   └── Layout.astro          # Layout base (<html>, <head>, <body>)
├── components/
│   ├── Header.astro           # Header wrapper (estructura estática)
│   ├── HeaderClient.tsx       # React island (sticky behavior, mobile menu, dropdowns)
│   ├── Footer.astro           # Footer (100% estático, sin JS)
│   └── icons/
│       └── SocialIcons.astro  # Iconos SVG de redes sociales
```

### Decisiones de Arquitectura

- **Footer es 100% Astro** — No necesita interactividad, no carga JS
- **Header usa React island** — Framer Motion requiere React; el island maneja: sticky compactado, dropdowns animados, mobile drawer
- **`client:load`** para el header island — Es visible inmediatamente, debe hidratar al cargar
- **Tailwind** maneja todo el responsive via clases utilitarias mobile-first

## Tipografía

- **Headings:** Inter o similar sans-serif geométrica, peso 600-700
- **Body:** Inter, peso 400
- **Nav:** Inter, peso 500, tracking ligeramente amplio (letter-spacing: 0.025em)

## Breakpoints

| Nombre | Valor | Uso |
|--------|-------|-----|
| Mobile | < 768px | Stack vertical, hamburger menu |
| Tablet | 768px - 1024px | Grid 2 columnas footer, nav visible |
| Desktop | > 1024px | Layout completo, grid 4 columnas footer |

## Páginas Internas (Estructura observada)

### Página: Lojas (`/lojas`)

- Título "LOJAS" centrado
- Campo de búsqueda ("Buscar loja")
- Mapa Google Maps embebido (clusters de markers)
- Grid de cards de tiendas (3 columnas desktop, 1 mobile):
  - Nombre de la tienda (h2, link)
  - Dirección completa
  - Link "Como chegar" con icono → abre Google Maps

### Página: Ofertas (`/ofertas`)

- Modal/overlay de selección de ciudad (combobox con ~23 ciudades)
- Sección "Tabloides": imagen de portada del tabloide (link a PDF)
- Sección "Ofertas do dia": video YouTube embebido
- Banner "Radar de Ofertas" (link externo)
- Múltiples secciones "Carrosséis de Ofertas":
  - Header con título + fecha de validez
  - Carousel de imágenes (8 slides) con navegación prev/next
  - Categorías observadas: Fecha Mês, Especial Kids, Especial Automotivos, Mundo Saudável
- Disclaimer legal al final (texto sobre validez de precios)

### Página: Empresa/Institucional (`/institucional`)

- Grid 2 columnas con categorías expandibles:
  - **Institucional:** Nossa história, Nossa estrutura, Fundador, Prêmios, ESG, Notícias, Auto Posto, Regulamento
  - **Serviços Financeiros:** Megafacilidades, Formas de pagamento, CPF na Nota, Cata moeda, Z-ON card
  - **Ações Condor:** Universidade Corporativa, Sustentabilidade, Cultura/Esporte/Lazer, Instituto Joanir Zonta, Campanha Solidária
  - **Para Sua Empresa:** Cartões (Alimentação, Convênio, Empresa, Presente)
  - Links directos: Demonstrativos Financeiros, Relatório de Transparência
- Sección de libros: "Um Paranaense" y "Na Intimidade do Sucesso" (con download PDF)

## Fuera de Alcance (Primera Fase — Solo Layout)

- Contenido dinámico de páginas internas (mapas, carousels, videos)
- SEO, meta tags, Open Graph
- Cookie consent banner
- Integración con APIs o CMS
- Selector de ciudad para ofertas
