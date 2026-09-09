output "alb_dns" {
  description = "DNS del balanceador de produccion."
  value       = module.ambiente.alb_dns
}

output "alb_zona" {
  description = "Zona hospedada del ALB, si el dominio se migra a Route53."
  value       = module.ambiente.alb_zona
}

output "asg_nombre" {
  description = "Auto Scaling Group de produccion. El rollback dispara su instance refresh."
  value       = module.ambiente.asg_nombre
}

output "db_endpoint" {
  description = "Base de produccion."
  value       = module.ambiente.db_endpoint
}

output "cognito_pool_id" {
  description = "User pool de produccion: administrativos, socios e invitados."
  value       = module.ambiente.cognito_pool_id
}

output "cognito_cliente_id" {
  description = "App client de produccion para la SPA y el movil."
  value       = module.ambiente.cognito_cliente_id
}
