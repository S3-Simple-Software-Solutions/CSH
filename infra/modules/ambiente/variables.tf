variable "ambiente" {
  description = "Nombre del ambiente: dev, pruebas o produccion."
  type        = string

  validation {
    condition     = contains(["dev", "pruebas", "produccion"], var.ambiente)
    error_message = "Los ambientes del SOW son dev, pruebas y produccion."
  }
}

variable "region" {
  description = "Region del ambiente."
  type        = string
}

variable "cidr" {
  description = "Rango de la VPC."
  type        = string
}

variable "zonas" {
  description = "Zonas de disponibilidad."
  type        = list(string)
}

variable "registro_nombre" {
  description = "Nombre del repositorio ECR compartido (se crea en ambientes/comun)."
  type        = string
  default     = "csh"
}

variable "imagen_tag" {
  description = "Tag de la imagen a correr. Es la version desplegada del ambiente."
  type        = string
}

# --- Base de datos ---

variable "db_nombre" {
  description = "Nombre de la base."
  type        = string
  default     = "csh"
}

variable "version_postgres" {
  description = "Version del motor Aurora PostgreSQL."
  type        = string
  default     = "16.4"
}

variable "acu_minimo" {
  description = "Capacidad minima en ACU."
  type        = number
  default     = 0.5
}

variable "acu_maximo" {
  description = "Capacidad maxima en ACU."
  type        = number
  default     = 2
}

variable "dias_respaldo" {
  description = "Retencion de respaldos automaticos, en dias."
  type        = number
  default     = 7
}

variable "proteger_borrado" {
  description = "Bloquea el borrado del cluster y exige snapshot final."
  type        = bool
  default     = false
}

# --- Identidad (Cognito) ---

variable "urls_retorno" {
  description = "URLs de retorno del login. Vacias mientras el dominio no exista."
  type        = list(string)
  default     = []
}

variable "urls_salida" {
  description = "URLs de retorno del logout."
  type        = list(string)
  default     = []
}

variable "prefijo_dominio" {
  description = "Prefijo del dominio hosted de Cognito, unico por region."
  type        = string
  default     = null
}

variable "seguridad_avanzada" {
  description = "Deteccion de credenciales comprometidas en Cognito. Tiene costo por usuario activo."
  type        = bool
  default     = false
}

# --- Computo ---

variable "puerto_app" {
  description = "Puerto donde escucha la app."
  type        = number
  default     = 8080
}

variable "tipo_instancia" {
  description = "Tipo de instancia EC2."
  type        = string
  default     = "t3.small"
}

variable "instancias_minimas" {
  description = "Piso del Auto Scaling Group."
  type        = number
  default     = 1
}

variable "instancias_maximas" {
  description = "Techo del Auto Scaling Group."
  type        = number
  default     = 2
}

variable "instancias_deseadas" {
  description = "Capacidad inicial."
  type        = number
  default     = 1
}

variable "warm_pool" {
  description = "Instancias apagadas listas para el pico."
  type        = bool
  default     = false
}

variable "warm_pool_minimo" {
  description = "Cuantas instancias esperan apagadas."
  type        = number
  default     = 2
}

variable "solicitudes_por_instancia" {
  description = "Solicitudes por instancia que disparan el escalado."
  type        = number
  default     = 1000
}

variable "agenda" {
  description = "Escalado agendado para aperturas de venta conocidas."
  type = map(object({
    recurrencia = string
    minimo      = number
    maximo      = number
    deseado     = number
  }))
  default = {}
}

variable "waf" {
  description = "Activa el WAF sobre el ALB."
  type        = bool
  default     = false
}

variable "certificado_arn" {
  description = "Certificado ACM para el 443."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}
