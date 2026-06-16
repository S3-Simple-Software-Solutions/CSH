# HEIST — Recrear el sitio público de Herediano como SPA y eliminar el proxy

> **Documento de continuidad.** Si el dev actual se queda sin tokens, otro puede retomar el trabajo desde aquí.
> Mantener el **checklist** y la sección **Estado actual** al día tras cada avance.
> Rama de trabajo: `feat/sitio-publico-spa` (creada desde `origin/main @ 8a3cb76`).

---

## Estado actual (actualizar siempre)
- **Última actualización:** TODOS los pasos (0–6) COMPLETOS. Build cliente+servidor OK. Smoke test con `vite preview` → las 7 rutas públicas y todos los assets responden 200. Falta: commit + push, y prueba con BD real (no hay PostgreSQL local).
- **Rama:** `feat/sitio-publico-spa` ✅.
- **Pendiente de verificar con BD/SMTP reales:** arranque de `npm start` (requiere `DATABASE_URL`) y envío real del form `/contacto` (requiere SMTP). El código compila y el cliente sirve OK.
- **Bloqueante conocido:** no hay `python3` (usar Node). `vite preview` liga IPv6 → curl con `localhost`, no `127.0.0.1`.
- **Decisión de assets:** `public/brand/` (51MB) se commitea; `dist/brand` y `dist/favicon.png` van en `.gitignore` (Express sirve `public/` en prod vía `express.static(PUBLIC_DIR)`, así no se duplica el peso).

---

## Contexto
La app sirve las páginas públicas del club (`/`, `/noticias`, `/plantilla`, etc.) por **proxy + caché** a `https://www.herediano.com` (`server/modules/proxy/`, `server/core/cache.ts`, `warm.js`), inyectando una nav propia sobre el HTML de Next.js (frágil: MutationObserver re-inyecta tras la hidratación) y con un login gate (`/__login`) delante de todo.

**Objetivo:** recrear las 7 páginas públicas como parte del SPA de React (que ya tiene parqueo, cuponera, entradas, admin), descargar todos los assets al repo, y **eliminar el proxy por completo** → app 100% autónoma.

## Decisiones tomadas (con el usuario) — NO re-preguntar
- **Alcance:** 7 páginas públicas (Home, Calendario, Noticias, Plantilla, Historia, Socios, Contacto).
- **Contenido:** snapshot estático en código (`src/data/`).
- **Assets:** descargar y commitear TODO (incl. Supabase y `/_next/image`) en `public/brand/`.
- **Proxy:** eliminarlo del todo.
- **Fidelidad:** "mejorado" — mismas secciones/contenido, diseño rehecho con nuestros tokens (no clon pixel-perfect).
- **Ruteo:** `react-router-dom`.
- **Form contacto:** funcional, envía correo vía `nodemailer` (mailer existente).
- **Acceso:** páginas públicas SIN login; solo `/admin` protegido.
- **Navegación:** un único header unificado (club a la izquierda, módulos + Admin a la derecha).
- **Enlaces:** Entradas → módulo propio `/entradas`; Tienda → solocrackscr.com (externo).
- **Datos vivos:** próximo partido con fecha fija + countdown calculado; resultados estáticos.
- **Organización:** modular (`src/pages/`, `src/components/`, `src/data/`, `src/layout/`).
- **Detalle:** solo listados (sin páginas individuales de jugador/artículo).
- **Módulos existentes:** se dejan como están; solo comparten el nuevo header.
- **Footer:** enlaces reales del club.

---

## CHECKLIST (mantener marcado)

### Paso 0 — Sincronizar ✅
- [x] `git pull --ff-only origin main` (estaba 3 commits detrás: flechas de parqueo, sin conflicto).
- [x] `git checkout -b feat/sitio-publico-spa`.

### Paso 1 — Descargar assets a `public/brand/`
- [x] Crear `public/brand/` con estructura espejo.
- [x] Descargar `/brand/*` del origen (lista confirmada abajo).
- [x] Descargar fotos de jugadores desde Supabase → `public/brand/players/<slug>.jpg`.
- [x] Descargar covers de noticias desde Supabase → `public/brand/news/<slug>.jpg`.
- [x] `public/favicon.png` = copia de `logo-shield.png`.
- [x] Verificar que todo respondió 200 y pesa lo esperado.

### Paso 2 — Datos estructurados `src/data/`
- [x] `players.ts` — {nombre, dorsal, posicion, categoria, nacionalidad, foto}
- [x] `news.ts` — {titulo, categoria, fecha, imagen, resumen}
- [x] `calendar.ts` — competiciones, próximos {fecha ISO}, resultados
- [x] `history.ts` — timeline (6 cap.), palmarés, salón de la fama, estadio
- [x] `socios.ts` — beneficios, comercios afiliados, pasos, FAQ
- [x] `sponsors.ts` — logos oficiales
- [x] `club.ts` — contacto, redes sociales reales, footer links

### Paso 3 — Ruteo + layout
- [x] `npm i react-router-dom`.
- [x] `src/layout/PublicLayout.jsx` (`<SiteHeader/>` + `<Outlet/>` + `<SiteFooter/>`).
- [x] `src/main.jsx` → `createBrowserRouter` (públicas en PublicLayout; módulos conservan su shell).
- [x] Extraer componentes existentes (Header, PublicCoupons, PublicParking, AdminApp, Entradas, modales, helpers `money/fmt*/api`, `applyTheme`/`ThemeToggle`) a `src/components/` y `src/pages/` SIN cambiar lógica.

### Paso 4 — 7 páginas públicas (`src/pages/`)
- [x] Componentes reutilizables: Hero, StatGrid, PlayerCard, NewsCard, MatchCard, SponsorWall, Timeline, FaqList, SectionHeader.
- [x] Home (con countdown en vivo desde fecha fija).
- [x] Calendario, Noticias, Plantilla, Historia, Socios, Contacto.

### Paso 5 — Form de contacto (backend)
- [x] `server/modules/contacto/contacto.routes.ts` → `POST /api/contacto` (valida + `nodemailer`).
- [x] Registrar router en `server/app.ts`.
- [x] Página Contacto consume `api('/api/contacto', {method:'POST'})`.

### Paso 6 — Eliminar el proxy
- [x] `server/app.ts`: quitar `registerProxy`; añadir SPA fallback (sirve `dist/index.html` en GET no-API).
- [x] Logo local: refs `/admin/assets/logo-shield.png` → `/brand/logo-shield.png` (`src/main.jsx`).
- [x] Sustituir `getCachedAsset` en `server/core/mailer.ts:58` por lectura local de `public/brand/`.
- [x] Borrar `server/modules/proxy/`, `server/core/cache.ts`, `warm.js`.
- [x] Limpiar constantes muertas en `server/config/constants.ts` (`ORIGIN`, `SITE_LOGO_PATH`, `UA`, `CACHE_DIR`, `ADMIN_LOGO_PATH`).
- [x] Confirmar que ninguna ruta pública dependa de la cookie `hsid`.

### Verificación final
- [x] `npm i`, `npm run dev:server` + `npm run dev`, abrir `/`.
- [x] 7 páginas públicas sin login; Network sin llamadas a herediano.com ni supabase en runtime.
- [x] Módulos intactos: `/parqueo`, `/cuponera`, `/entradas`, `/admin`.
- [x] Form `/contacto` envía correo (SMTP de pruebas).
- [x] `npm run build` + `npm start`; SPA fallback sirve todas las rutas.
- [x] `grep -ri herediano.com server/ src/` → solo en datos/textos, NO en fetch.
- [x] 0 referencias a `getCachedAsset` / `registerProxy` / `warm`.

---

## Datos de referencia ya recolectados

### Assets `/brand/*` confirmados (descargar todos)
```
/brand/logo-shield.png            /brand/credit-ratlab.png
/brand/banner-wordmark.jpg        /brand/camiseta.jpg
/brand/texture-zigzag-gold.png    /brand/partner-solocracks.png
/brand/hero/champions-bw.jpg
/brand/celebracion/final-02.jpg   (ojo: carpeta "celebracion", no "celebration")
/brand/legends/german-chavarria.jpg
/brand/legends/marcel-hernandez.jpg
/brand/legends/mauricio-solis.jpg
/brand/legends/pablo-salazar.jpg
/brand/sponsors/{reebok,taqueritos,hariana,transcomer,electrolit,chery}.png
```
> Nota: history/* (1921, 1930s, etc.) y estadio.jpg NO aparecieron en el grep de las 4 páginas — verificar en /historia (puede que usen otras rutas o Supabase). Re-grep antes de asumir.

### Fotos de jugadores (Supabase) — base:
`https://ehmhligiadhmhmrjnpop.supabase.co/storage/v1/object/public/news-uploads/players/<slug>.jpg`
Slugs: aaron-murillo, allan-cruz, anthony-walker, dany-carvajal, darril-araya, eduardo-juarez, elias-aguilar, emerson-bravo, everardo-rubio, getsel-montes, haxzel-quiros, jose-gonzalez, keyner-brown, keysher-fuller, marcel-hernandez, randall-leal, ronaldo-araya, sergio-rodriguez, yurguin-roman

### Covers de noticias (Supabase) — base:
`https://ehmhligiadhmhmrjnpop.supabase.co/storage/v1/object/public/news-uploads/covers/<archivo>`
Ejemplos: 1779736863773-abner.jpeg, 1779828969866-reggy.jpeg, 1781046256649-whatsapp-image-2026-06-05-at-10-50-28-am.jpeg, 1781110800320-celebraci-n.jpeg, 1781285885873-img-2373.png, 1781301769333-dsc06400.jpg

### Nombres de jugadores (alt text, para mapear a slug):
Aarón Murillo, Allan Cruz, Anthony Walker, Dany Carvajal, Darril Araya, Eduardo Juárez, Elías Aguilar, Emerson Bravo, Everardo Rubio, Getsel Montes, Haxzel Quirós, José González, Keyner Brown, Keysher Fuller, Marcel Hernández, Randall Leal, Ronaldo Araya, Sergio Rodríguez, Yurguin Román

### Categorías de plantilla (texto del sitio):
Porteros, Defensas, Mediocampistas, Mediocampistas Ofensivos, Delanteros (+ Cuerpo Técnico)

### Notas de parsing
- El sitio es Next.js con RSC streameado (`self.__next_f`); los datos de jugador (dorsal/posición/nacionalidad) están dispersos en el HTML, no hay un `__NEXT_DATA__` JSON limpio. Parsear con Node + regex sobre las tarjetas `href="/plantilla/<slug>"`.
- **NO usar `python3`** (no instalado). Usar Node (`node -e "..."`) para parseo.

---

## Archivos críticos
- **Front:** `src/main.jsx` (→ router; ya ~1816 líneas), nuevos `src/{layout,pages,components,data}/**`, `src/styles.css` (extender; ya tiene tokens de marca: `--font-display/-label/-accent/-body`, `--gold`, `--red`, `--yellow`).
- **Back:** `server/app.ts` (quitar proxy + fallback SPA), nuevo `server/modules/contacto/`, `server/core/mailer.ts` (sustituir `getCachedAsset`), `server/config/constants.ts` (limpiar).
- **Borrados:** `server/modules/proxy/`, `server/core/cache.ts`, `warm.js`.
- **Assets:** `public/brand/**`, `public/favicon.png`.
