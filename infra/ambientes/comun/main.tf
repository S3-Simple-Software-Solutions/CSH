# Recursos compartidos por los tres ambientes.
#
# Hoy es solo el registro de imagenes: uno para todos, para que la imagen que
# se aprobo en pruebas sea exactamente la que sale a produccion.

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
    key            = "csh/comun/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "csh-terraform-locks"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Proyecto  = "CSH"
      Terraform = "true"
      Repo      = "S3-Simple-Software-Solutions/CSH"
    }
  }
}

module "registro" {
  source = "../../modules/registro"

  nombre               = "csh"
  imagenes_a_conservar = 20
}
