variable "imagen_tag" {
  description = "Tag de la imagen desplegada. El CI lo pasa en cada deploy."
  type        = string
  default     = "dev"
}
