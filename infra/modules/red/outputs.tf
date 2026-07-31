output "vpc_id" {
  description = "Id de la VPC del ambiente."
  value       = aws_vpc.principal.id
}

output "subredes_publicas" {
  description = "Subredes publicas: ALB e instancias."
  value       = aws_subnet.publica[*].id
}

output "subredes_privadas" {
  description = "Subredes privadas: base de datos."
  value       = aws_subnet.privada[*].id
}

output "sg_alb" {
  description = "Security group del balanceador."
  value       = aws_security_group.alb.id
}

output "sg_app" {
  description = "Security group de las instancias."
  value       = aws_security_group.app.id
}

output "sg_base" {
  description = "Security group de la base de datos."
  value       = aws_security_group.base.id
}
