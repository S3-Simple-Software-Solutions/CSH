#!/usr/bin/env bash
# Registra un runner self-hosted local para S3-Simple-Software-Solutions/CSH
# con el label `csh-local`, y lo deja como servicio systemd --user.
#
# Un runner solo puede estar registrado a un scope, por eso este vive en un
# directorio aparte del runner de `greenfield` que ya existe en ~/actions-runner.
#
# Requisitos: `gh` autenticado con permiso de admin sobre el repo.
set -euo pipefail

REPO="${REPO:-S3-Simple-Software-Solutions/CSH}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner-csh}"
RUNNER_NAME="${RUNNER_NAME:-csh-local}"
RUNNER_LABELS="${RUNNER_LABELS:-csh-local}"
SERVICE_NAME="${SERVICE_NAME:-github-runner-csh}"
RUNNER_VERSION="${RUNNER_VERSION:-2.336.0}"

if [ -f "$RUNNER_DIR/.runner" ]; then
  echo "Ya existe un runner configurado en $RUNNER_DIR:"
  cat "$RUNNER_DIR/.runner"
  echo "Borralo primero (./config.sh remove) si querés reconfigurarlo."
  exit 1
fi

echo "==> Descargando runner v$RUNNER_VERSION en $RUNNER_DIR"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
if [ ! -f "$TARBALL" ]; then
  curl -fsSL -o "$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
fi
tar xzf "$TARBALL"

echo "==> Obteniendo token de registro para $REPO"
REG_TOKEN=$(gh api -X POST "repos/$REPO/actions/runners/registration-token" --jq .token)

echo "==> Configurando runner '$RUNNER_NAME' (labels: $RUNNER_LABELS)"
# Salta la dependencia de libicu, que no esta instalada y requeriria sudo.
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
./config.sh \
  --url "https://github.com/$REPO" \
  --token "$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work _work \
  --unattended \
  --replace

echo "==> Instalando servicio systemd --user: $SERVICE_NAME"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=GitHub Actions Runner ($RUNNER_NAME)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$RUNNER_DIR
# Salta la dependencia libicu (no instalada) sin sudo.
Environment=DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
# claude y gh viven en rutas de usuario que el servicio no hereda por defecto.
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$RUNNER_DIR/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

echo "==> Listo. Estado:"
systemctl --user status "$SERVICE_NAME" --no-pager | head -12
echo
echo "Para que corra sin sesion iniciada: sudo loginctl enable-linger $USER"
