# Sincroniza main y dev tras clone o antes de empezar trabajo.
# Uso: npm run sync:branches

$ErrorActionPreference = "Stop"

git fetch origin

git checkout main
if ($LASTEXITCODE -ne 0) { throw "No se pudo cambiar a main" }
git pull origin main

if (git rev-parse --verify dev 2>$null) {
  git checkout dev
} elseif (git rev-parse --verify origin/dev 2>$null) {
  git checkout -b dev origin/dev
} else {
  Write-Host "Rama dev no existe en remoto; creando desde main."
  git checkout -b dev
}

git pull origin dev 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Sin remoto dev todavía; solo main actualizado."
} else {
  git merge origin/main --no-edit
}

Write-Host ""
Write-Host "Listo. main y dev sincronizados. Rama actual: dev"
