output "pool_id" {
  description = "Id del user pool."
  value       = aws_cognito_user_pool.principal.id
}

output "autoridad" {
  description = "Issuer del pool. La app valida los tokens contra esta URL."
  value       = "https://cognito-idp.${data.aws_region.actual.name}.amazonaws.com/${aws_cognito_user_pool.principal.id}"
}

output "cliente_id" {
  description = "App client que usan la SPA y el movil."
  value       = aws_cognito_user_pool_client.app.id
}

output "grupos" {
  description = "Grupos del pool, en orden de precedencia."
  value = [
    aws_cognito_user_group.administrativos.name,
    aws_cognito_user_group.socios.name,
    aws_cognito_user_group.invitados.name,
  ]
}

output "dominio" {
  description = "Dominio hosted de Cognito, si se configuro."
  value       = var.prefijo_dominio == null ? null : aws_cognito_user_pool_domain.principal[0].domain
}

data "aws_region" "actual" {}
