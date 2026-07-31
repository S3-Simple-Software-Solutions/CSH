output "alb_dns" {
  description = "DNS publico del balanceador. Es lo que apunta el registro DNS del ambiente."
  value       = aws_lb.principal.dns_name
}

output "alb_zona" {
  description = "Zona hospedada del ALB, para un alias de Route53 si se migra el dominio."
  value       = aws_lb.principal.zone_id
}

output "asg_nombre" {
  description = "Nombre del Auto Scaling Group. El deploy lo usa para el instance refresh."
  value       = aws_autoscaling_group.app.name
}

output "target_group_arn" {
  description = "Target group de la app."
  value       = aws_lb_target_group.app.arn
}
