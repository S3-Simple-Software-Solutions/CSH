variable "ambiente" {
  description = "Nombre del ambiente: dev, pruebas o produccion."
  type        = string
}

variable "cidr" {
  description = "Rango de la VPC. Uno distinto por ambiente para poder emparejarlos despues sin colisiones."
  type        = string
}

variable "zonas" {
  description = "Zonas de disponibilidad. El SOW pide alta disponibilidad: minimo dos."
  type        = list(string)

  validation {
    condition     = length(var.zonas) >= 2
    error_message = "Hacen falta al menos dos zonas de disponibilidad."
  }
}

variable "puerto_app" {
  description = "Puerto donde escucha la app dentro de la instancia."
  type        = number
  default     = 8080
}

variable "tags" {
  description = "Tags adicionales para todos los recursos."
  type        = map(string)
  default     = {}
}
