# Un ambiente completo: red + base de datos + computo.
#
# Existe para que dev, pruebas y produccion sean el mismo codigo con distintos
# numeros. Si un ambiente necesita una pieza que los otros no tienen, va como
# variable con default, no como una copia del modulo.

module "red" {
  source = "../red"

  ambiente   = var.ambiente
  cidr       = var.cidr
  zonas      = var.zonas
  puerto_app = var.puerto_app
  tags       = var.tags
}

module "datos" {
  source = "../datos"

  ambiente         = var.ambiente
  subredes         = module.red.subredes_privadas
  security_group   = module.red.sg_base
  nombre_base      = var.db_nombre
  version_postgres = var.version_postgres
  acu_minimo       = var.acu_minimo
  acu_maximo       = var.acu_maximo
  dias_respaldo    = var.dias_respaldo
  proteger_borrado = var.proteger_borrado
  tags             = var.tags
}

# El repositorio de imagenes es uno solo para los tres ambientes y se crea en
# ambientes/comun. Se busca por nombre en vez de leer su state: asi los
# ambientes no dependen del state de otro.
data "aws_ecr_repository" "app" {
  name = var.registro_nombre
}

module "computo" {
  source = "../computo"

  ambiente          = var.ambiente
  region            = var.region
  vpc_id            = module.red.vpc_id
  subredes_publicas = module.red.subredes_publicas
  sg_alb            = module.red.sg_alb
  sg_app            = module.red.sg_app

  imagen       = "${data.aws_ecr_repository.app.repository_url}:${var.imagen_tag}"
  registro_arn = data.aws_ecr_repository.app.arn

  secreto_arn = module.datos.secreto_arn
  db_host     = module.datos.endpoint
  db_puerto   = module.datos.puerto
  db_nombre   = module.datos.nombre_base

  puerto_app                = var.puerto_app
  tipo_instancia            = var.tipo_instancia
  instancias_minimas        = var.instancias_minimas
  instancias_maximas        = var.instancias_maximas
  instancias_deseadas       = var.instancias_deseadas
  warm_pool                 = var.warm_pool
  warm_pool_minimo          = var.warm_pool_minimo
  solicitudes_por_instancia = var.solicitudes_por_instancia
  agenda                    = var.agenda
  waf                       = var.waf
  certificado_arn           = var.certificado_arn

  tags = var.tags
}
