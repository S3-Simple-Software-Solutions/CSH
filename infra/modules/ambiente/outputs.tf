output "alb_dns" {
  description = "DNS del balanceador. A esto apunta el hostname del ambiente."
  value       = module.computo.alb_dns
}

output "alb_zona" {
  description = "Zona hospedada del ALB."
  value       = module.computo.alb_zona
}

output "asg_nombre" {
  description = "Auto Scaling Group. El deploy dispara su instance refresh."
  value       = module.computo.asg_nombre
}

output "db_endpoint" {
  description = "Endpoint de escritura de la base del ambiente."
  value       = module.datos.endpoint
}

output "db_secreto_arn" {
  description = "Secreto administrado por RDS con la clave del usuario maestro."
  value       = module.datos.secreto_arn
}

output "vpc_id" {
  description = "VPC del ambiente."
  value       = module.red.vpc_id
}
