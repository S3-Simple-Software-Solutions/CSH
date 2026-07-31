output "alb_dns" {
  description = "DNS del balanceador de dev. A esto apunta herediano-dev."
  value       = module.ambiente.alb_dns
}

output "asg_nombre" {
  description = "Auto Scaling Group de dev."
  value       = module.ambiente.asg_nombre
}

output "db_endpoint" {
  description = "Base de dev. Separada de produccion: eso es B3 del SOW."
  value       = module.ambiente.db_endpoint
}
