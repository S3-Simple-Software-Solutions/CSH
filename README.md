# CSH

Cached Club Sport Herediano proxy with login, admin shell, and parking management module.

## Run locally

```bash
node server.js
```

The app listens on `PORT` or `8088` by default.

## Warm the site cache

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
