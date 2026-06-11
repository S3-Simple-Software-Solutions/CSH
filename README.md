# CSH

React + PostgreSQL Club Sport Herediano proxy with login, admin shell, and parking management module.

## Run locally

```bash
npm install
npm run build
npm start
```

The app listens on `PORT` or `8088` by default. PostgreSQL is required through `DATABASE_URL`; on first boot the server creates the parking schema and migrates existing `data/parqueo.json` data if present.

Example local database:

```bash
podman run -d --name herediano-postgres \
  -e POSTGRES_USER=herediano \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=herediano \
  -p 127.0.0.1:5441:5432 \
  -v herediano-postgres-data:/var/lib/postgresql/data \
  docker.io/library/postgres:16-alpine
```

Then set:

```bash
DATABASE_URL=postgres://herediano:change-me@127.0.0.1:5441/herediano
```

## Develop React

```bash
npm run dev
```

## Warm the proxied site cache

```bash
node warm.js
```

## Main routes

- `/` proxied Herediano site, behind login.
- `/__login` site login.
- `/admin/sign-in` admin login.
- `/admin/parqueo` parking management.
- `/parqueo` public parking availability and payment.

Runtime cache, logs, `.env`, and live parking data are intentionally ignored.
