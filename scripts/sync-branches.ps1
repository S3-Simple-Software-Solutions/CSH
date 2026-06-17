# Sincroniza main y john-dev tras clone o antes de empezar trabajo.
# Uso: npm run sync:branches

$ErrorActionPreference = "Stop"
$IntegrationBranch = "john-dev"

git fetch origin

git checkout main
if ($LASTEXITCODE -ne 0) { throw "No se pudo cambiar a main" }
git pull origin main

if (git rev-parse --verify $IntegrationBranch 2>$null) {
  git checkout $IntegrationBranch
} elseif (git rev-parse --verify "origin/$IntegrationBranch" 2>$null) {
  git checkout -b $IntegrationBranch "origin/$IntegrationBranch"
} else {
  Write-Host "Rama $IntegrationBranch no existe en remoto; creando desde main."
  git checkout -b $IntegrationBranch
}

git pull "origin" $IntegrationBranch 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Sin remoto $IntegrationBranch todavía; solo main actualizado."
} else {
  git merge origin/main --no-edit
}

Write-Host ""
Write-Host "Listo. main y $IntegrationBranch sincronizados. Rama actual: $IntegrationBranch"
