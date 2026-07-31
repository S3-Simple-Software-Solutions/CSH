# Base de datos del ambiente: Aurora PostgreSQL Serverless v2.
#
# Cada ambiente tiene su propio cluster. Ese es el punto entero de B3 del SOW:
# hoy dev y produccion comparten instancia, y un error en pruebas toca datos
# reales (riesgo R1 del acta).
#
# La clave del usuario maestro la administra RDS en Secrets Manager
# (manage_master_user_password): no se genera en Terraform, asi no queda
# escrita en el state.

locals {
  nombre = "csh-${var.ambiente}"

  tags = merge(var.tags, {
    Ambiente  = var.ambiente
    Proyecto  = "CSH"
    Terraform = "true"
  })
}

resource "aws_db_subnet_group" "principal" {
  name       = local.nombre
  subnet_ids = var.subredes

  tags = merge(local.tags, { Name = local.nombre })
}

resource "aws_rds_cluster" "principal" {
  cluster_identifier = local.nombre
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.version_postgres

  database_name               = var.nombre_base
  master_username             = var.usuario_maestro
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.principal.name
  vpc_security_group_ids = [var.security_group]
  port                   = 5432

  storage_encrypted = true

  # Los respaldos se detallan en la epica BA.EP4 (#58); aca queda la retencion
  # minima para que el cluster nazca con respaldo, no sin el.
  backup_retention_period = var.dias_respaldo
  copy_tags_to_snapshot   = true

  # En produccion no se borra por accidente; en los otros ambientes destruir y
  # recrear tiene que ser barato.
  deletion_protection       = var.proteger_borrado
  skip_final_snapshot       = !var.proteger_borrado
  final_snapshot_identifier = var.proteger_borrado ? "${local.nombre}-final" : null

  serverlessv2_scaling_configuration {
    min_capacity = var.acu_minimo
    max_capacity = var.acu_maximo
  }

  tags = merge(local.tags, { Name = local.nombre })
}

resource "aws_rds_cluster_instance" "principal" {
  count = var.instancias

  identifier          = "${local.nombre}-${count.index + 1}"
  cluster_identifier  = aws_rds_cluster.principal.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.principal.engine
  engine_version      = aws_rds_cluster.principal.engine_version
  publicly_accessible = false

  tags = merge(local.tags, { Name = "${local.nombre}-${count.index + 1}" })
}
