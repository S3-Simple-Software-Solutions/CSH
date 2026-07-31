# Ambiente de produccion.
#
# Unico con warm pool, WAF y proteccion de borrado. El riesgo operativo del
# proyecto es la apertura de venta de boletos: por eso el warm pool y el limite
# por IP no son adornos.

terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  backend "s3" {
    bucket         = "antonyproyects"
    key            = "csh/produccion/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "csh-terraform-locks"
  }
}

provider "aws" {
  region = local.region

  default_tags {
    tags = {
      Proyecto  = "CSH"
      Ambiente  = "produccion"
      Terraform = "true"
      Repo      = "S3-Simple-Software-Solutions/CSH"
    }
  }
}

locals {
  region = "us-east-1"
  zonas  = ["us-east-1a", "us-east-1b"]
}

module "ambiente" {
  source = "../../modules/ambiente"

  ambiente = "produccion"
  region   = local.region
  zonas    = local.zonas
  cidr     = "10.30.0.0/16"

  imagen_tag = var.imagen_tag

  acu_minimo       = 0.5
  acu_maximo       = 8
  dias_respaldo    = 14
  proteger_borrado = true

  tipo_instancia      = "t3.medium"
  instancias_minimas  = 2
  instancias_maximas  = 10
  instancias_deseadas = 2

  # Instancias apagadas listas para el pico: sin esto, escalar en una apertura
  # de venta implica esperar a que arranque una maquina fria.
  warm_pool        = true
  warm_pool_minimo = 2

  waf = true

  # Deteccion de credenciales comprometidas en Cognito. Cuesta por usuario
  # activo, asi que solo aca: es donde una cuenta tomada compra entradas.
  seguridad_avanzada = true

  # Las aperturas conocidas se agendan aca. Ejemplo comentado para no dejar una
  # agenda inventada corriendo:
  # agenda = {
  #   apertura-lunes = {
  #     recurrencia = "30 9 * * 1"
  #     minimo      = 4
  #     maximo      = 10
  #     deseado     = 6
  #   }
  # }
}
