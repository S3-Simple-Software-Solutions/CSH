# Ambiente de desarrollo.
#
# El mas chico de los tres: una instancia, sin warm pool y sin WAF. Se puede
# destruir y recrear sin ceremonia — de eso se trata tener base propia.

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
    key            = "csh/dev/terraform.tfstate"
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
      Ambiente  = "dev"
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

  ambiente = "dev"
  region   = local.region
  zonas    = local.zonas
  cidr     = "10.10.0.0/16"

  imagen_tag = var.imagen_tag

  # Base chica: dev no sostiene carga, sostiene pruebas manuales.
  acu_minimo       = 0.5
  acu_maximo       = 1
  dias_respaldo    = 1
  proteger_borrado = false

  tipo_instancia      = "t3.small"
  instancias_minimas  = 1
  instancias_maximas  = 2
  instancias_deseadas = 1
}
