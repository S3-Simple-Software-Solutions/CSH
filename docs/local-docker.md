# Desarrollo local con Docker

Levanta todo el stack de desarrollo —base, backend .NET y frontend Vite— en
contenedores, sin instalar el SDK ni Node en la máquina. Solo hace falta Docker.

Es una **alternativa** al flujo nativo de dos terminales de
[`harness_DEV.md §3`](harness_DEV.md); no lo reemplaza. Elegí uno de los dos.

## Levantar todo

```bash
docker compose -f docker-compose.dev.yml up
```

La primera vez tarda: baja las imágenes, hace `dotnet restore` y `npm install`.
Cuando esté arriba:

| URL | Qué es |
|---|---|
| http://localhost:5173 | SPA (Vite). La UI se trabaja acá; **la cookie BFF no pega todavía** (callback en `:5080`). |
| http://localhost:5080 | Backend + login BFF (`/api/auth/login`) + `/healthz` |
| localhost:5432 | PostgreSQL (`postgres` / `postgres`, base `csh_dev`) |

El frontend proxea `/api` y `/healthz` al backend. El callback OIDC
(`/signin-oidc`) **no** pasa por Vite: el login con cookie se prueba en
`:5080` hasta que eso se cablee. Detalle en [`harness_DEV.md` §3](harness_DEV.md).

Hot reload: editás un `.cs` y el backend recompila solo; editás el frontend y
el navegador refresca. Para bajarlo, `Ctrl+C` y `docker compose -f
docker-compose.dev.yml down` (agregá `-v` para borrar también la base).

## Solo la base

Si preferís correr backend y frontend nativos (más rápido, hot reload sin
polling) y solo querés Postgres en Docker:

```bash
docker compose -f docker-compose.dev.yml up db
```

Y en dos terminales, lo de `harness_DEV.md §3`:
```bash
dotnet watch --project backend/src/CSH.Host
npm run dev --prefix frontend
```

## Trampas conocidas

- **Windows / WSL — hot reload.** Los watchers sobre volúmenes montados no ven
  los cambios sin polling. Ya está activado en el compose
  (`DOTNET_USE_POLLING_FILE_WATCHER`, `CHOKIDAR_USEPOLLING`). Si aun así no
  recarga, reiniciá el servicio.
- **`obj/`, `bin/`, `node_modules/` de otra plataforma.** Si compilaste de forma
  nativa en Windows antes de usar el compose, esos directorios tienen artefactos
  de Windows que rompen dentro del contenedor Linux. Usá un clon limpio o corré
  `git clean -xdf` antes de `up`. El `node_modules` del contenedor vive en un
  volumen aparte para no pisar el del host.
- **El puerto del backend.** El contenedor tiene que bindear `0.0.0.0:5080`.
  `launchSettings.json` pisa eso con `localhost`; el compose arranca con
  `--no-launch-profile`. Si cambiás el puerto, tocalo en el compose y en
  `frontend/vite.config.ts`.
- **Cognito.** El compose carga `.env.cognito.dev` (`Cognito__*`). Sin ese
  archivo el Host no arranca. No se commitea.

## Qué NO cubre todavía

La SPA en Vite no recibe la cookie del BFF (orígenes `:5173` vs `:5080`).
Data Protection keys viven en el disco del contenedor: al recrearlo se pierden
las cookies. `ALLOW_ADMIN_USER_PASSWORD_AUTH` en el client móvil es solo para
pruebas. Terraform `infra/modules/identidad` aún no declara los dos clients.
