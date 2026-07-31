output "endpoint" {
  description = "Endpoint de escritura del cluster."
  value       = aws_rds_cluster.principal.endpoint
}

output "endpoint_lectura" {
  description = "Endpoint de solo lectura. Candidato para el modulo de analytics."
  value       = aws_rds_cluster.principal.reader_endpoint
}

output "puerto" {
  description = "Puerto del cluster."
  value       = aws_rds_cluster.principal.port
}

output "nombre_base" {
  description = "Nombre de la base creada."
  value       = aws_rds_cluster.principal.database_name
}

output "secreto_arn" {
  description = "ARN del secreto que RDS administra con la clave del usuario maestro."
  value       = aws_rds_cluster.principal.master_user_secret[0].secret_arn
}
