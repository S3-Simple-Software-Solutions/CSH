variable "nombre" {
  description = "Nombre del repositorio de imagenes."
  type        = string
  default     = "csh"
}

variable "imagenes_a_conservar" {
  description = "Cuantas imagenes de release se conservan. Definen hasta donde se puede revertir."
  type        = number
  default     = 20
}

variable "permitir_borrado" {
  description = "Permite destruir el repositorio con imagenes adentro. Apagado fuera de pruebas."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}
