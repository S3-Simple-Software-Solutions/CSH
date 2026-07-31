variable "ambiente" {
  description = "Nombre del ambiente: dev, pruebas o produccion."
  type        = string
}

variable "urls_retorno" {
  description = "URLs de retorno del login. Mientras esten vacias, el flujo hosted de Cognito queda apagado."
  type        = list(string)
  default     = []
}

variable "urls_salida" {
  description = "URLs de retorno del logout."
  type        = list(string)
  default     = []
}

variable "prefijo_dominio" {
  description = "Prefijo del dominio de Cognito, unico por region. Ej: csh-dev. Null lo deja sin dominio hosted."
  type        = string
  default     = null
}

variable "seguridad_avanzada" {
  description = "Deteccion de credenciales comprometidas y de riesgo. Tiene costo por usuario activo: prendido en produccion."
  type        = bool
  default     = false
}

variable "proteger_borrado" {
  description = "Bloquea el borrado del user pool. Borrarlo se lleva todas las cuentas."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}
