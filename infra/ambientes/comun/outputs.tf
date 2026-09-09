output "registro_url" {
  description = "URL del repositorio de imagenes. El CI empuja aca."
  value       = module.registro.url
}

output "registro_nombre" {
  description = "Nombre del repositorio. Los ambientes lo buscan por este nombre."
  value       = module.registro.nombre
}
