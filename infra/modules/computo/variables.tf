variable "ambiente" {
  description = "Nombre del ambiente: dev, pruebas o produccion."
  type        = string
}

variable "region" {
  description = "Region donde vive el ambiente."
  type        = string
}

variable "vpc_id" {
  description = "VPC del ambiente."
  type        = string
}

variable "subredes_publicas" {
  description = "Subredes publicas: ALB e instancias."
  type        = list(string)
}

variable "sg_alb" {
  description = "Security group del balanceador."
  type        = string
}

variable "sg_app" {
  description = "Security group de las instancias."
  type        = string
}

variable "imagen" {
  description = "Imagen a correr, con tag. Ej: 1234.dkr.ecr.us-east-1.amazonaws.com/csh:0.7"
  type        = string
}

variable "registro_arn" {
  description = "ARN del repositorio ECR, para el permiso de bajada."
  type        = string
}

variable "secreto_arn" {
  description = "ARN del secreto con la clave de la base."
  type        = string
}

variable "db_host" {
  description = "Endpoint de escritura de la base."
  type        = string
}

variable "db_puerto" {
  description = "Puerto de la base."
  type        = number
  default     = 5432
}

variable "db_nombre" {
  description = "Nombre de la base."
  type        = string
}

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

variable "disco_gb" {
  description = "Tamano del volumen raiz. Va cifrado: guarda el archivo de entorno con la clave de la base."
  type        = number
  default     = 20
}

variable "memoria_contenedor" {
  description = "Techo de memoria del contenedor, para que un runaway no se lleve la instancia."
  type        = string
  default     = "1g"
}

variable "cognito_autoridad" {
  description = "Issuer del user pool de Cognito. La app valida los tokens contra esta autoridad."
  type        = string
}

variable "cognito_cliente_id" {
  description = "App client de Cognito que usan la SPA y el movil."
  type        = string
}

variable "instancias_minimas" {
  description = "Piso del Auto Scaling Group."
  type        = number
  default     = 1
}

variable "instancias_maximas" {
  description = "Techo del Auto Scaling Group. Es el limite de gasto en computo."
  type        = number
  default     = 2
}

variable "instancias_deseadas" {
  description = "Capacidad inicial."
  type        = number
  default     = 1
}

variable "warm_pool" {
  description = "Instancias apagadas listas para el pico. Solo tiene sentido donde hay aperturas de venta."
  type        = bool
  default     = false
}

variable "warm_pool_minimo" {
  description = "Cuantas instancias esperan apagadas."
  type        = number
  default     = 2
}

variable "solicitudes_por_instancia" {
  description = "Solicitudes por instancia que dispara el escalado."
  type        = number
  default     = 1000
}

variable "agenda" {
  description = <<-DESC
    Escalado agendado para aperturas de venta conocidas, en hora de Costa Rica.
    Ej: { apertura = { recurrencia = "30 9 * * 1", minimo = 4, maximo = 10, deseado = 6 } }
  DESC
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

variable "waf_limite_por_ip" {
  description = "Solicitudes por IP en cinco minutos antes de bloquear."
  type        = number
  default     = 2000
}

variable "certificado_arn" {
  description = "Certificado ACM para el 443. Mientras sea null, el ALB sirve por el 80."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}
