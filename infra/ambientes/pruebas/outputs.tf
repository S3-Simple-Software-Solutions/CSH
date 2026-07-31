output "alb_dns" {
  description = "DNS del balanceador de pruebas."
  value       = module.ambiente.alb_dns
}

output "asg_nombre" {
  description = "Auto Scaling Group de pruebas."
  value       = module.ambiente.asg_nombre
}

output "db_endpoint" {
  description = "Base de pruebas, con datos propios y no copia de produccion."
  value       = module.ambiente.db_endpoint
}

output "cognito_pool_id" {
  description = "User pool de pruebas: administrativos, socios e invitados."
  value       = module.ambiente.cognito_pool_id
}

output "cognito_cliente_id" {
  description = "App client de pruebas para la SPA y el movil."
  value       = module.ambiente.cognito_cliente_id
}
