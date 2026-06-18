# Deploys versionados y rollback

## Versiones

Cada `push` a `main` ejecuta `Deploy CSH` y crea la siguiente version numerica:

```text
0.3, 0.4, 0.5, ...
```

Ejemplo:

```text
0.3
```

Esa version se guarda como GitHub Release y tambien como una carpeta inmutable en
el servidor:

```text
/home/tony/Desktop/APP_CSH/releases/<release_version>
```

El servicio `csh.service` siempre corre desde:

```text
/home/tony/Desktop/APP_CSH/current
```

`current` es un symlink a la version activa. El archivo de entorno vive fuera de
las releases, en:

```text
/home/tony/Desktop/APP_CSH/shared/.env
```

## Rollback

Para volver a una version anterior:

1. Ir a **Actions** en GitHub.
2. Abrir **Rollback CSH**.
3. Ejecutar **Run workflow**.
4. Escribir el `release_version` exacto, por ejemplo `0.3`.
5. Opcionalmente escribir el motivo en `reason`.

El workflow valida que la version exista como GitHub Release. Si la carpeta de
esa version ya existe en el servidor, el rollback solo cambia el symlink
`current` y reinicia el servicio. Si no existe, reconstruye esa version desde el
tag de GitHub Release y luego la activa.
