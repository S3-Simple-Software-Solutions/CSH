# Ambiente de pruebas.
#
# El que el SOW exige y hoy no existe: donde el club valida antes de que un
# cambio toque produccion. Se parece a produccion en forma, no en tamano.

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
    key            = "csh/pruebas/terraform.tfstate"
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
      Ambiente  = "pruebas"
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

  ambiente = "pruebas"
  region   = local.region
  zonas    = local.zonas
  cidr     = "10.20.0.0/16"

  imagen_tag = var.imagen_tag

  acu_minimo       = 0.5
  acu_maximo       = 2
  dias_respaldo    = 7
  proteger_borrado = false

  # Dos instancias para que la UAT ejercite el balanceo, no una sola maquina.
  tipo_instancia      = "t3.small"
  instancias_minimas  = 1
  instancias_maximas  = 3
  instancias_deseadas = 2
}
