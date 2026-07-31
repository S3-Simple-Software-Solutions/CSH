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
