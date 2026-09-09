# Registro de imagenes.
#
# Hace falta porque la instancia no hornea nada: arranca de una AMI estandar,
# instala podman y baja la imagen que construyo el CI. Sin registro, la imagen
# solo existe en la maquina que la construyo.
#
# Es uno solo para todos los ambientes a proposito: la imagen que se probo en
# pruebas tiene que ser exactamente la que sale a produccion. Un repositorio
# por ambiente obligaria a reconstruir, y reconstruir es no probar lo mismo.

locals {
  tags = merge(var.tags, {
    Proyecto  = "CSH"
    Terraform = "true"
  })
}

resource "aws_ecr_repository" "app" {
  name                 = var.nombre
  image_tag_mutability = "IMMUTABLE"
  force_delete         = var.permitir_borrado

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.tags, { Name = var.nombre })
}

# Sin esto el repositorio crece para siempre: cada deploy deja una imagen.
resource "aws_ecr_lifecycle_policy" "retencion" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Conservar las ultimas ${var.imagenes_a_conservar} imagenes de release"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["0."]
          countType     = "imageCountMoreThan"
          countNumber   = var.imagenes_a_conservar
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Las imagenes sin tag se van a los 7 dias"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}
