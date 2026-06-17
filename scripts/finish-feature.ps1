# Fusiona un feature en dev y borra la rama local.
# Uso: npm run finish:feature -- feat/mi-feature

param(
  [Parameter(Mandatory = $true)]
  [string]$Branch
)

$ErrorActionPreference = "Stop"

if (-not (git rev-parse --verify $Branch 2>$null)) {
  throw "La rama '$Branch' no existe."
}

git fetch origin
git checkout dev
git pull origin dev
git merge origin/main --no-edit
git merge $Branch --no-edit
git branch -d $Branch

Write-Host ""
Write-Host "Feature '$Branch' fusionado en dev y rama local eliminada."
Write-Host "Ejecuta: git push origin dev"
