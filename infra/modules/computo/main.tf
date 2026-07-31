# Computo del ambiente: ALB + Auto Scaling Group.
#
# No hay AMI horneada por release (se descarto: obligaba a mantener dos caminos
# de build). La instancia arranca de la AMI estandar de Amazon Linux 2023,
# instala podman y corre la misma imagen que se construye con
# cicd/Containerfile. El release es el tag de la imagen.

locals {
  nombre = "csh-${var.ambiente}"

  tags = merge(var.tags, {
    Ambiente  = var.ambiente
    Proyecto  = "CSH"
    Terraform = "true"
  })

  # ECR devuelve la URL completa; para podman login hace falta solo el host.
  registro_host = split("/", var.imagen)[0]
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# --- Permisos de la instancia ------------------------------------------------

data "aws_iam_policy_document" "asumir" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instancia" {
  name               = "${local.nombre}-instancia"
  assume_role_policy = data.aws_iam_policy_document.asumir.json

  tags = local.tags
}

# Acceso por SSM en vez de llaves SSH: no hay que abrir el 22 ni repartir llaves.
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instancia.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instancia" {
  statement {
    sid    = "BajarImagen"
    effect = "Allow"
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = [var.registro_arn]
  }

  statement {
    sid       = "TokenDelRegistro"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Solo el secreto de la base de este ambiente, no todos los de la cuenta.
  statement {
    sid       = "ClaveDeLaBase"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.secreto_arn]
  }
}

resource "aws_iam_role_policy" "instancia" {
  name   = "${local.nombre}-instancia"
  role   = aws_iam_role.instancia.id
  policy = data.aws_iam_policy_document.instancia.json
}

resource "aws_iam_instance_profile" "instancia" {
  name = "${local.nombre}-instancia"
  role = aws_iam_role.instancia.name
}

# --- Plantilla de arranque ---------------------------------------------------

resource "aws_launch_template" "app" {
  name_prefix   = "${local.nombre}-"
  image_id      = data.aws_ami.al2023.id
  instance_type = var.tipo_instancia

  iam_instance_profile {
    arn = aws_iam_instance_profile.instancia.arn
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [var.sg_app]
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2 obligatorio
    http_endpoint = "enabled"

    # Un salto: alcanza para el user_data, que corre en el host, y deja al
    # contenedor sin acceso al servicio de metadatos. Con dos saltos, cualquier
    # cosa que se ejecute dentro del contenedor puede pedir las credenciales del
    # rol de la instancia. La app no las necesita: recibe todo por env.
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  # El volumen raiz guarda /etc/csh.env con la clave de la base y los logs.
  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.disco_gb
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  monitoring {
    enabled = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {
    region             = var.region
    registro_host      = local.registro_host
    imagen             = var.imagen
    secreto_arn        = var.secreto_arn
    db_host            = var.db_host
    db_puerto          = var.db_puerto
    db_nombre          = var.db_nombre
    puerto             = var.puerto_app
    memoria_contenedor = var.memoria_contenedor
    cognito_autoridad  = var.cognito_autoridad
    cognito_cliente_id = var.cognito_cliente_id
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.tags, { Name = local.nombre })
  }

  lifecycle {
    create_before_destroy = true
  }
}

# --- Balanceador -------------------------------------------------------------

resource "aws_lb" "principal" {
  name               = local.nombre
  load_balancer_type = "application"
  subnets            = var.subredes_publicas
  security_groups    = [var.sg_alb]

  drop_invalid_header_fields = true

  tags = merge(local.tags, { Name = local.nombre })
}

resource "aws_lb_target_group" "app" {
  name     = local.nombre
  port     = var.puerto_app
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # La apertura de venta genera picos: conviene sacar rapido una instancia que
  # dejo de responder, sin castigar un pico de latencia puntual.
  health_check {
    path                = "/healthz"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(local.tags, { Name = local.nombre })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.principal.arn
  port              = 80
  protocol          = "HTTP"

  # Mientras no haya certificado (el dominio esta sin definir) el 80 sirve la
  # app. Apenas exista, el 80 redirige y el trafico real va por el 443.
  dynamic "default_action" {
    for_each = var.certificado_arn == null ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.app.arn
    }
  }

  dynamic "default_action" {
    for_each = var.certificado_arn == null ? [] : [1]
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.certificado_arn == null ? 0 : 1

  load_balancer_arn = aws_lb.principal.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificado_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# --- Auto Scaling ------------------------------------------------------------

resource "aws_autoscaling_group" "app" {
  name                = local.nombre
  vpc_zone_identifier = var.subredes_publicas
  target_group_arns   = [aws_lb_target_group.app.arn]

  min_size         = var.instancias_minimas
  max_size         = var.instancias_maximas
  desired_capacity = var.instancias_deseadas

  # Con "ELB" una instancia que arranco pero no sirve la app se reemplaza sola.
  health_check_type         = "ELB"
  health_check_grace_period = 180

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  # Un deploy es una plantilla nueva: el refresh reemplaza las instancias sin
  # tumbar el servicio. Es lo que sustituye al symlink `current` de la infra vieja.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 180
    }
  }

  # Instancias apagadas listas para prenderse: absorben el pico sin pagar
  # computo encendido y sin el arranque frio de instalar podman y bajar la
  # imagen. Va adentro del grupo, no como recurso aparte.
  dynamic "warm_pool" {
    for_each = var.warm_pool ? [1] : []
    content {
      pool_state = "Stopped"
      min_size   = var.warm_pool_minimo

      instance_reuse_policy {
        reuse_on_scale_in = true
      }
    }
  }

  dynamic "tag" {
    for_each = merge(local.tags, { Name = local.nombre })
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

# Para lo que no se puede anticipar. Las aperturas de venta conocidas se agendan
# con scheduled scaling (var.agenda).
resource "aws_autoscaling_policy" "por_solicitudes" {
  name                   = "${local.nombre}-solicitudes"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.principal.arn_suffix}/${aws_lb_target_group.app.arn_suffix}"
    }
    target_value = var.solicitudes_por_instancia
  }
}

resource "aws_autoscaling_schedule" "agenda" {
  for_each = var.agenda

  scheduled_action_name  = each.key
  autoscaling_group_name = aws_autoscaling_group.app.name
  recurrence             = each.value.recurrencia
  min_size               = each.value.minimo
  max_size               = each.value.maximo
  desired_capacity       = each.value.deseado
  time_zone              = "America/Costa_Rica"
}

# --- WAF ---------------------------------------------------------------------

resource "aws_wafv2_web_acl" "principal" {
  count = var.waf ? 1 : 0

  name  = local.nombre
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "comunes"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.nombre}-comunes"
      sampled_requests_enabled   = true
    }
  }

  # El riesgo concreto de este dominio: bots acaparando boletos en la apertura.
  rule {
    name     = "limite-por-ip"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_limite_por_ip
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.nombre}-limite"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = local.nombre
    sampled_requests_enabled   = true
  }

  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "principal" {
  count = var.waf ? 1 : 0

  resource_arn = aws_lb.principal.arn
  web_acl_arn  = aws_wafv2_web_acl.principal[0].arn
}
