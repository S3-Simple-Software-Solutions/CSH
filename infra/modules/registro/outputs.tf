output "url" {
  description = "URL del repositorio. El CI empuja aca y las instancias bajan de aca."
  value       = aws_ecr_repository.app.repository_url
}

output "arn" {
  description = "ARN del repositorio, para los permisos de las instancias."
  value       = aws_ecr_repository.app.arn
}

output "nombre" {
  description = "Nombre del repositorio."
  value       = aws_ecr_repository.app.name
}
