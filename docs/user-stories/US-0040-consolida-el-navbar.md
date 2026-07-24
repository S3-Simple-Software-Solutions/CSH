---
id: US-0040
issue: 40
issue_url: https://github.com/S3-Simple-Software-Solutions/CSH/issues/40
stage: Backlog
generated_at: 2026-07-24T22:34:27.148Z
---

I'm exploring the repo to understand how the navbar is currently implemented on public vs admin pages, so the user story is grounded in the actual code rather than generic assumptions.
I'll wait for that approval and the explore agent in parallel.
The issue context was already provided directly in the task (number, URL, author, title, body), so I don't need the GitHub API call. Waiting for the codebase exploration to finish.
I'll wait for the exploration agent to finish before drafting the user story.
Waiting for the exploration agent's completion notification before drafting the user story.
I have enough to report.

## Navbar Implementation Report

**Two separate navbar implementations found, no shared component:**

1. **Public navbar** — `/home/tony/Desktop/APP_CSH/src/layout/SiteHeader.jsx` (239 lines). A full-featured top nav: logo/brand link (`club.logo` from `src/data/club.js:10`), links from `navMain`/`navModules` (`src/data/club.js:48-63`), a slide-out mobile drawer (`site-nav`, backdrop, `Escape`/outside-click to close, hamburger `Menu`/`X` icons via `lucide-react`), a `ThemeToggle`, and auth-aware states (guest login/register CTAs vs logged-in user chip that routes to `/admin` for admin users or `/mi-cuenta` for members, plus logout). Fetches session via `api('/api/session')` (SiteHeader.jsx:95). Used by two layout wrappers:
   - `src/layout/PublicLayout.jsx` — header + `<Outlet/>` + `SiteFooter`
   - `src/layout/ServiceLayout.jsx` — header + `<Outlet/>`, no footer (for parqueo/cuponera/entradas/comida/salones)

2. **Admin navbar** — `/home/tony/Desktop/APP_CSH/src/layout/AdminTopBar.jsx` (38 lines), a minimal top bar (no logo, just a menu-toggle button, a "Ver sitio" back-to-site link, user name/role, `ThemeToggle`, logout button). It's rendered *inside* `AdminApp()` in `src/app-modules.jsx:1726-1801` (usage at line 1796), alongside a separate left sidebar (`<aside>` at line 1760) built inline with `AdminNavButton` components — the actual admin "menu" is this sidebar, not the top bar, and it's unique to the admin section (no shared code with `SiteHeader`).

**Routing split** (`src/main.jsx:58-86`): `createBrowserRouter` splits into a `PublicLayout` branch (`/`, `/historia`, `/plantilla`, etc.), a `ServiceLayout` branch (`/parqueo`, `/cuponera`, `/entradas/*`, `/comida/*`, `/salones`), and a catch-all `{ path: '/admin/*', element: <AdminApp/> }` with no shared layout element. `AdminApp` (app-modules.jsx:1726) does its own auth guard: loads `/api/session`, shows `<LoginPage/>` if unauthenticated, and `location.replace('/')` if authenticated but not `isAdminUser` (Auth.jsx).

**Concrete differences:**
- Structure: SiteHeader = horizontal top bar + off-canvas drawer; Admin = fixed left sidebar + thin top bar (`AdminTopBar`), collapsible via `navCollapsed` state persisted in `localStorage`.
- Branding: SiteHeader shows club logo + "Herediano" wordmark; AdminTopBar has no logo (brand lives in the sidebar `admin-nav-head`, app-modules.jsx:1762).
- Nav items: SiteHeader driven by shared data (`navMain`/`navModules` in `data/club.js`); Admin nav items are hardcoded `AdminNavButton` elements in `app-modules.jsx` (1775-1793), conditionally rendered by role (`user.eventsRole`, `user.restaurantRole`, `user.isSuperAdmin`).
- Auth awareness: SiteHeader has guest vs logged-in UI variants (desktop/mobile/drawer); AdminTopBar assumes an authenticated admin user always.
- Mobile: SiteHeader has a dedicated `site-quick` compact action bar and burger menu; Admin uses `admin-nav-backdrop` + `menuOpen` toggle for the sidebar.
- CSS: separate stylesheets — public nav styled in `src/site.css` (~51 nav-related rule blocks), admin nav/shell styled in `src/styles.css` (~31 rule blocks) — no shared class names between the two (`site-*` vs `admin-*` prefixes).

**Stack:** React 19 + `react-router-dom` v7 (`createBrowserRouter`), Vite build, plain CSS (two large hand-written stylesheets `src/styles.css` and `src/site.css`, no Tailwind/CSS-modules), icons via `lucide-react`. No component library/design-system folder exists; `src/components/` only has `DataTable.jsx`, `Loading.jsx`, `site.jsx` (small shared bits, not a UI kit). `src/app-modules.jsx` is a single very large (333KB) file containing most admin logic including `AdminApp`, `AdminTopBar` usage, and the sidebar markup — no separate `AdminLayout.jsx` file exists despite `AdminTopBar.jsx` living in `src/layout/`.

**No existing tests reference navbar/header components** — the only `*.test.js` in the repo is `src/pages/entradas/SeatPicker.test.js`, unrelated to navigation.

**Suggestion:** Consolidate into a single `src/layout/AppHeader.jsx` (or keep `SiteHeader.jsx` as the base since it already has auth-awareness and role-based routing logic) that accepts a `variant`/`context` prop (`public` | `admin`) to toggle branding target, nav-item source, and drawer vs. sidebar-toggle behavior; move nav item config for admin into `src/data/` alongside `club.js` (e.g. `adminNav.js`) to mirror the existing `navMain`/`navModules` pattern; extract a proper `src/layout/AdminLayout.jsx` wrapping the sidebar + new shared header, wired into `main.jsx`'s router instead of the ad-hoc `AdminApp` shell; unify styling by merging the `site-top`/`admin-topbar` rule sets into one set of shared classes.
# US-0040: Consolidar el Navbar entre el sitio público y el panel de administración

## Source Issue
- Issue number: #40
- Issue URL: https://github.com/S3-Simple-Software-Solutions/CSH/issues/40
- Author: anthonyOviedo

## Expanded Problem

El sitio público y el panel de administración de Club Sport Herediano usan implementaciones de navegación completamente independientes, sin componentes ni estilos compartidos:

- **Público**: `src/layout/SiteHeader.jsx` — barra superior horizontal con logo/marca (`club.logo`, `src/data/club.js`), enlaces provenientes de `navMain`/`navModules`, menú móvil tipo drawer (deslizante), `ThemeToggle`, y estados según sesión (invitado vs. usuario logueado, con enrutamiento a `/admin` o `/mi-cuenta`). Se usa en `PublicLayout.jsx` y `ServiceLayout.jsx` (parqueo, cuponera, entradas, comida, salones).
- **Admin**: `src/layout/AdminTopBar.jsx` — barra superior mínima (sin logo) embebida dentro de `AdminApp()` en `src/app-modules.jsx`, junto a un sidebar izquierdo construido inline con botones (`AdminNavButton`) codificados a mano y condicionados por rol (`eventsRole`, `restaurantRole`, `isSuperAdmin`).

Ambas implementaciones tienen su propio CSS (`site.css` con prefijo `site-*` vs. `styles.css` con prefijo `admin-*`), su propia lógica de colapso/apertura de menú, y ninguna fuente de verdad compartida para los ítems de navegación. Esto genera inconsistencia visual y de comportamiento (branding ausente en admin, patrones de menú móvil distintos, duplicación de lógica de auth/logout) y duplica el esfuerzo de mantenimiento cada vez que se agrega o cambia un enlace de navegación.

No existe hoy una librería de componentes compartida (`src/components/` solo tiene `DataTable.jsx`, `Loading.jsx`, `site.jsx`) ni un `AdminLayout.jsx` propiamente dicho — el shell de admin vive mezclado dentro del archivo de 333KB `app-modules.jsx`.

## User Story

Como administrador o miembro autenticado de Club Sport Herediano, quiero que la barra de navegación tenga una identidad visual y de comportamiento consistente entre el sitio público y el panel de administración, para no perder el sentido de marca ni tener que reaprender patrones de interacción distintos al moverme entre ambas áreas.

## Inputs

- Datos de navegación pública existentes: `navMain` / `navModules` en `src/data/club.js`.
- Ítems de navegación de admin actualmente hardcodeados en `src/app-modules.jsx` (líneas ~1775-1793), condicionados por rol de usuario.
- Sesión/rol del usuario vía `api('/api/session')` y helpers de `Auth.jsx` (`isAdminUser`).
- Branding del club (`club.logo`, wordmark "Herediano").

## Outputs

- Un componente de navegación consolidado (p. ej. `src/layout/AppHeader.jsx`, o `SiteHeader.jsx` extendido con una prop `variant`/`context`: `public` | `admin`) reutilizado en ambas áreas.
- Un archivo de configuración de navegación de admin (p. ej. `src/data/adminNav.js`) que espeje el patrón de `navMain`/`navModules`, eliminando los `AdminNavButton` hardcodeados.
- Estilos unificados (clases compartidas entre lo que hoy son `site-*` y `admin-*`), conservando el layout de sidebar propio de admin donde sea necesario pero con la misma cabecera/branding.

## Functional Requirements

1. La cabecera debe mostrar el logo y marca del club en ambas áreas (público y admin), hoy ausente en `AdminTopBar.jsx`.
2. Los estados de sesión (invitado, miembro logueado, admin) deben renderizarse con el mismo componente y lógica, evitando la duplicación actual entre `SiteHeader.jsx` y el guard de auth en `AdminApp()`.
3. El menú de admin debe seguir soportando la visibilidad condicional por rol (`eventsRole`, `restaurantRole`, `isSuperAdmin`) pero leyendo su configuración desde una fuente de datos declarativa, no desde markup inline en `app-modules.jsx`.
4. El toggle de tema (`ThemeToggle`) y el logout deben mantener comportamiento idéntico en ambas áreas.
5. Debe existir un enlace directo y visible para moverse entre el sitio público y el panel de admin (hoy "Ver sitio" solo existe en `AdminTopBar`).
6. El comportamiento responsive/móvil (drawer en público, sidebar colapsable en admin) debe consolidarse bajo un mismo patrón de interacción, o justificarse explícitamente por qué difiere.
7. La navegación pública actual (`PublicLayout`, `ServiceLayout`, rutas de parqueo/cuponera/entradas/comida/salones) no debe romperse ni cambiar su URL/comportamiento actual salvo el rediseño visual acordado.

## Non-Functional Requirements

- No introducir una nueva librería de UI/CSS framework (el proyecto usa CSS plano, sin Tailwind/CSS-modules); mantener consistencia con `site.css`/`styles.css` o fusionarlos deliberadamente.
- No degradar el rendimiento de carga del router (`main.jsx`, `createBrowserRouter`) ni introducir renders adicionales de sesión (`/api/session`) más allá de los actuales.
- Mantener accesibilidad existente del drawer público (cierre con `Escape`, click fuera, foco).
- El cambio debe ser incremental y no bloquear otros módulos que dependen de `app-modules.jsx` (archivo grande y sensible).

## Acceptance Criteria

- [ ] Dado que un usuario visita el sitio público, la cabecera muestra el logo del club, los enlaces de `navMain`/`navModules` y el estado de sesión correcto (invitado/logueado).
- [ ] Dado que un administrador entra a `/admin/*`, la cabecera muestra el mismo logo/marca y el mismo componente de header que el sitio público, con el menú de administración (sidebar) mostrando solo los ítems permitidos por su rol.
- [ ] Dado que un administrador hace clic en "Ver sitio" (o equivalente), navega al sitio público sin perder sesión.
- [ ] Dado que un usuario cambia el tema (claro/oscuro) desde el header, el cambio se aplica igual en público y en admin.
- [ ] Dado que se agrega o modifica un ítem de navegación de admin, esto se hace editando un archivo de datos (no JSX hardcodeado dentro de `app-modules.jsx`).
- [ ] No hay regresiones visuales ni funcionales en las rutas públicas existentes (`/`, `/historia`, `/plantilla`, `/parqueo`, `/cuponera`, `/entradas/*`, `/comida/*`, `/salones`).
- [ ] El logout funciona igual desde ambas áreas y redirige consistentemente.
- [ ] En viewport móvil, el menú de admin y el menú público tienen un comportamiento de apertura/cierre coherente (o la diferencia está documentada como decisión de diseño).

## Edge Cases

- Usuario con sesión de miembro (no admin) que intenta acceder a `/admin/*` — debe seguir siendo redirigido (`location.replace('/')`), sin que el nuevo header rompa ese guard.
- Usuario sin sesión que llega directamente a `/admin/*` — debe ver `LoginPage` con una cabecera consistente, no la vacía actual.
- Admin con múltiples roles (`eventsRole` + `restaurantRole` + `isSuperAdmin`) — el menú debe combinar correctamente los ítems visibles sin duplicados.
- Cambio de tema mientras el drawer/sidebar está abierto — no debe cerrar el menú ni perder el estado de navegación.
- Sesión expirada mientras el usuario navega dentro de admin — el header debe reflejar el logout/expiración sin quedar en un estado inconsistente (ej. mostrando nombre de usuario obsoleto).

## Dependencies

- `src/layout/SiteHeader.jsx`, `src/layout/AdminTopBar.jsx`, `src/layout/PublicLayout.jsx`, `src/layout/ServiceLayout.jsx`.
- `src/app-modules.jsx` (`AdminApp()`, sidebar inline, líneas ~1726-1801) — refactor de alto riesgo por el tamaño del archivo (333KB).
- `src/data/club.js` (`navMain`, `navModules`) como referencia de patrón para la nueva config de nav de admin.
- `src/main.jsx` (router: `createBrowserRouter`) si se decide introducir un `AdminLayout.jsx` real en vez del guard ad-hoc actual.
- `Auth.jsx` (`isAdminUser`) y endpoint `/api/session`.
- Hojas de estilo `src/site.css` y `src/styles.css`.
- No hay tests existentes que cubran navbar/header (`SeatPicker.test.js` es el único test del repo y no aplica) — cualquier consolidación queda sin red de seguridad automatizada salvo que se agregue cobertura como parte de esta historia.

## Open Questions

- ¿Se desea que el sidebar de admin desaparezca en favor de un patrón de navegación horizontal como el público, o se mantiene el sidebar pero con la cabecera unificada?
- ¿El botón "Ver sitio" debe conservarse tal cual o se reemplaza por el logo/marca como punto de retorno (patrón común en paneles admin)?
- ¿Se aprovecha este trabajo para dividir `app-modules.jsx` y extraer un `AdminLayout.jsx` dedicado, o se busca el cambio mínimo dentro del archivo actual?
- ¿Hay lineamientos de marca (logo, colores, tipografía) documentados en algún lugar fuera del código que deban respetarse en la versión consolidada?
- ¿Se requiere soporte para roles adicionales o vistas de navegación específicas (ej. `restaurantRole` vs `eventsRole`) que deban diseñarse explícitamente en el nuevo componente?

## Suggested First Slice

Extraer la configuración de navegación de admin a un archivo de datos (`src/data/adminNav.js`) y modificar `AdminTopBar.jsx` para incluir logo/marca y reutilizar la lógica de sesión de `SiteHeader.jsx`, sin tocar aún el sidebar ni fusionar CSS. Esto valida el patrón de datos compartidos y da consistencia de branding con el menor riesgo, dejando la unificación de estructura (drawer vs. sidebar) y el refactor de `app-modules.jsx` para una segunda iteración.
