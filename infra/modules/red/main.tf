# Red base de un ambiente.
#
# Sin NAT Gateway a proposito (docs/infra.md): las instancias van en subred
# publica con IP publica y el security group solo deja entrar al ALB. Un NAT
# Gateway cuesta mas que las instancias que serviria.
#
# La base de datos si va en subredes privadas: no necesita salida a internet,
# asi que no cuesta nada tenerla aislada.

locals {
  nombre = "csh-${var.ambiente}"

  tags = merge(var.tags, {
    Ambiente  = var.ambiente
    Proyecto  = "CSH"
    Terraform = "true"
  })
}

resource "aws_vpc" "principal" {
  cidr_block           = var.cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, { Name = local.nombre })
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = merge(local.tags, { Name = local.nombre })
}

# --- Subredes ---------------------------------------------------------------

resource "aws_subnet" "publica" {
  count = length(var.zonas)

  vpc_id                  = aws_vpc.principal.id
  availability_zone       = var.zonas[count.index]
  cidr_block              = cidrsubnet(var.cidr, 8, count.index)
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${local.nombre}-publica-${var.zonas[count.index]}"
    Capa = "publica"
  })
}

resource "aws_subnet" "privada" {
  count = length(var.zonas)

  vpc_id            = aws_vpc.principal.id
  availability_zone = var.zonas[count.index]
  cidr_block        = cidrsubnet(var.cidr, 8, count.index + 100)

  tags = merge(local.tags, {
    Name = "${local.nombre}-privada-${var.zonas[count.index]}"
    Capa = "privada"
  })
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = merge(local.tags, { Name = "${local.nombre}-publica" })
}

resource "aws_route_table_association" "publica" {
  count = length(aws_subnet.publica)

  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

# --- Security groups en cadena: internet -> ALB -> app -> base ---------------

resource "aws_security_group" "alb" {
  name        = "${local.nombre}-alb"
  description = "Entrada publica al balanceador"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nombre}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP publico"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS publico"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_salida" {
  security_group_id = aws_security_group.alb.id
  description       = "Salida hacia las instancias"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "app" {
  name        = "${local.nombre}-app"
  description = "Instancias de la aplicacion"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nombre}-app" })
}

# La unica entrada a la app es el ALB. Nadie llega al puerto directo, aunque la
# instancia tenga IP publica.
resource "aws_vpc_security_group_ingress_rule" "app_desde_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "Solo el ALB entra al puerto de la app"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.puerto_app
  to_port                      = var.puerto_app
  ip_protocol                  = "tcp"
}

# Salida abierta: la instancia necesita bajar la imagen de ECR y hablar con
# Secrets Manager. Sin NAT, eso sale por la IP publica de la instancia.
resource "aws_vpc_security_group_egress_rule" "app_salida" {
  security_group_id = aws_security_group.app.id
  description       = "Salida a internet (ECR, Secrets Manager, actualizaciones)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "base" {
  name        = "${local.nombre}-base"
  description = "Base de datos"
  vpc_id      = aws_vpc.principal.id

  tags = merge(local.tags, { Name = "${local.nombre}-base" })
}

resource "aws_vpc_security_group_ingress_rule" "base_desde_app" {
  security_group_id            = aws_security_group.base.id
  description                  = "Solo la app entra a Postgres"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
