# Fusiona un feature en john-dev y borra la rama local.
# Uso: npm run finish:feature -- feat/mi-feature

param(
  [Parameter(Mandatory = $true)]
  [string]$Branch
)

$ErrorActionPreference = "Stop"
$IntegrationBranch = "john-dev"

if (-not (git rev-parse --verify $Branch 2>$null)) {
  throw "La rama '$Branch' no existe."
}

git fetch origin
git checkout $IntegrationBranch
git pull origin $IntegrationBranch
git merge origin/main --no-edit
git merge $Branch --no-edit
git branch -d $Branch

Write-Host ""
Write-Host "Feature '$Branch' fusionado en $IntegrationBranch y rama local eliminada."
Write-Host "Ejecuta: git push origin $IntegrationBranch"
