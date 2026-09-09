variable "ambiente" {
  description = "Nombre del ambiente: dev, pruebas o produccion."
  type        = string
}

variable "subredes" {
  description = "Subredes privadas donde vive el cluster."
  type        = list(string)
}

variable "security_group" {
  description = "Security group de la base: solo entra la app."
  type        = string
}

variable "nombre_base" {
  description = "Nombre de la base que se crea con el cluster."
  type        = string
  default     = "csh"
}

variable "usuario_maestro" {
  description = "Usuario maestro. La clave la genera y rota RDS en Secrets Manager."
  type        = string
  default     = "csh_admin"
}

variable "version_postgres" {
  description = "Version del motor Aurora PostgreSQL."
  type        = string
  default     = "16.4"
}

variable "acu_minimo" {
  description = "Capacidad minima en ACU. 0 permite pausar el cluster cuando no hay trafico."
  type        = number
  default     = 0.5
}

variable "acu_maximo" {
  description = "Capacidad maxima en ACU. Es el techo de gasto del ambiente."
  type        = number
  default     = 2
}

variable "instancias" {
  description = "Instancias del cluster. Una alcanza salvo que se necesite lectura separada."
  type        = number
  default     = 1
}

variable "dias_respaldo" {
  description = "Dias de retencion de respaldos automaticos."
  type        = number
  default     = 7
}

variable "proteger_borrado" {
  description = "Bloquea el borrado del cluster y exige snapshot final. Prendido en produccion."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags adicionales para todos los recursos."
  type        = map(string)
  default     = {}
}
