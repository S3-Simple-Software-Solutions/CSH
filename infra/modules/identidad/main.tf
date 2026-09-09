# Identidad: Cognito.
#
# Las cuentas —administrativos, socios e invitados— viven en Cognito, no en una
# tabla de la aplicacion. Consecuencia importante para el backend: CSH.Usuarios
# deja de guardar credenciales. Guarda el perfil del aficionado y lo relaciona
# con el `sub` de Cognito, que es el identificador estable de la persona.
#
# Cognito emite los tokens; la app los valida contra el issuer del user pool.
# Eso sirve igual a la SPA y a la app movil, que ya iba a usar bearer.

locals {
  nombre = "csh-${var.ambiente}"

  tags = merge(var.tags, {
    Ambiente  = var.ambiente
    Proyecto  = "CSH"
    Terraform = "true"
  })

  # OAuth solo se habilita cuando ya hay a donde volver. Mientras el dominio
  # este sin definir, el pool existe y el flujo hosted queda apagado.
  oauth = length(var.urls_retorno) > 0
}

resource "aws_cognito_user_pool" "principal" {
  name = local.nombre

  # La persona se identifica por correo. Un usuario aparte del correo obliga al
  # aficionado a recordar dos cosas.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  # Segundo factor disponible. Obligarlo a todo el mundo dejaria afuera al
  # aficionado que compra una entrada una vez al ano; para administrativos se
  # exige por grupo desde la aplicacion.
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  # Protege contra credential stuffing, que es el riesgo real de una cuenta con
  # entradas y medios de pago asociados.
  user_pool_add_ons {
    advanced_security_mode = var.seguridad_avanzada ? "ENFORCED" : "OFF"
  }

  schema {
    name                     = "name"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 128
    }
  }

  # Numero de socio: lo emite el club, no la persona. Sirve para amarrar la
  # cuenta con el padron de membresias (M11) sin duplicar el padron en Cognito.
  schema {
    name                     = "numero_socio"
    attribute_data_type      = "String"
    required                 = false
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 0
      max_length = 32
    }
  }

  deletion_protection = var.proteger_borrado ? "ACTIVE" : "INACTIVE"

  tags = merge(local.tags, { Name = local.nombre })
}

# --- Grupos ------------------------------------------------------------------
# La precedencia decide que rol gana cuando una persona pertenece a mas de uno:
# el numero mas bajo manda.

resource "aws_cognito_user_group" "administrativos" {
  name         = "administrativos"
  user_pool_id = aws_cognito_user_pool.principal.id
  description  = "Personal del club: taquilla, parqueo, comercial, comunicacion"
  precedence   = 1
}

resource "aws_cognito_user_group" "socios" {
  name         = "socios"
  user_pool_id = aws_cognito_user_pool.principal.id
  description  = "Socios con membresia vigente y sus beneficios"
  precedence   = 10
}

resource "aws_cognito_user_group" "invitados" {
  name         = "invitados"
  user_pool_id = aws_cognito_user_pool.principal.id
  description  = "Aficionado registrado sin membresia"
  precedence   = 100
}

# --- Cliente -----------------------------------------------------------------

resource "aws_cognito_user_pool_client" "app" {
  name         = local.nombre
  user_pool_id = aws_cognito_user_pool.principal.id

  # Sin secreto: lo usan la SPA y la app movil, donde un secreto no se puede
  # guardar. La seguridad la da PKCE, no un secreto embebido en el cliente.
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  # Corto el de acceso, largo el de refresco: es la misma decision que ya se
  # habia tomado para el movil — poder cortar el acceso rapido sin obligar a
  # entrar de nuevo todos los dias.
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  enable_token_revocation       = true
  prevent_user_existence_errors = "ENABLED"

  allowed_oauth_flows_user_pool_client = local.oauth
  allowed_oauth_flows                  = local.oauth ? ["code"] : []
  allowed_oauth_scopes                 = local.oauth ? ["email", "openid", "profile"] : []
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.urls_retorno
  logout_urls   = var.urls_salida

  read_attributes  = ["email", "email_verified", "name", "custom:numero_socio"]
  write_attributes = ["email", "name"]
}

resource "aws_cognito_user_pool_domain" "principal" {
  count = var.prefijo_dominio == null ? 0 : 1

  domain       = var.prefijo_dominio
  user_pool_id = aws_cognito_user_pool.principal.id
}
