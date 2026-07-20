# Acta de Constitución del Proyecto

> **DRAFT — versión 0.1.** Documento editable. Los campos entre `[corchetes]` deben
> completarse o confirmarse con el patrocinador antes de circular para firma.
> Estructura basada en la guía de acta de proyecto de Atlassian.

---

## 1. Información general

| Campo | Valor |
|---|---|
| **Nombre del proyecto** | Plataforma digital Club Sport Herediano (APP_CSH) |
| **Código / repositorio** | `S3-Simple-Software-Solutions/CSH` |
| **Patrocinador (sponsor)** | `[Nombre y cargo — p. ej. Gerencia General CSH]` |
| **Gerente / líder de proyecto** | `[Nombre]` |
| **Proveedor / equipo ejecutor** | S3 Simple Software Solutions |
| **Cliente** | Club Sport Herediano |
| **Fecha de elaboración** | `[dd/mm/aaaa]` |
| **Fecha de inicio del proyecto** | `[dd/mm/aaaa]` |
| **Fecha objetivo de cierre de fase** | `[dd/mm/aaaa]` |
| **Versión del acta** | 0.1 (borrador) |

---

## 2. Propósito y justificación

El Club Sport Herediano opera hoy varios procesos de cara al aficionado y a sus
socios comerciales de forma manual o dispersa: venta y control de entradas,
parqueo del estadio, beneficios de socios, consumo de comida en el estadio,
relación con patrocinadores y alquiler de espacios físicos.

El proyecto consolida todos esos procesos en **una sola plataforma web** con un
sitio público para el aficionado y un panel administrativo con permisos por
área, sobre una base de datos única. El objetivo de negocio es **aumentar el
ingreso por día de partido y por servicios no deportivos**, reducir el trabajo
manual del personal y darle al club información confiable para vender mejor sus
espacios comerciales.

**Problema que resuelve:** `[completar con el dolor concreto priorizado por el club:
p. ej. filas en taquilla, reventa no controlada, parqueo sin control de aforo,
falta de trazabilidad de la pauta de patrocinadores]`.

---

## 3. Descripción del proyecto

Plataforma web propia (no un sitio de terceros) compuesta por:

- **Sitio público:** home, historia, plantilla, calendario, noticias, socios,
  contacto, registro e inicio de sesión del aficionado.
- **Servicios al aficionado:** entradas, parqueo, cuponera, comida en el estadio
  y alquiler de salones.
- **Panel administrativo:** operación diaria de cada módulo, con roles y
  permisos separados por área.

### Módulos incluidos

| Módulo | Alcance funcional | Estado a la fecha |
|---|---|---|
| Entradas | Eventos, mapa de butacas, tipos de boleto, compra en línea, QR, validación en puerta, reventa (mercado secundario) | `[Operativo / en pruebas]` |
| Parqueo | Múltiples parqueos, croquis, reservas, precio por parqueo, pago y recibo | `[Operativo / en pruebas]` |
| Cuponera | Beneficios de socios, patrocinadores con beneficios propios | `[Operativo / en pruebas]` |
| Restaurantes | Locales del estadio, menú, pedidos con entrega en asiento o retiro, múltiples dueños por local | `[Operativo / en pruebas]` |
| Patrocinadores | Lista de patrocinadores y espacios donde pauta cada uno (web, vallas dentro/fuera, pantallas, entrada del estadio, entrada del parqueo) | `[Operativo / en pruebas]` |
| Alquiler de salones | Catálogo de salones, solicitudes de cotización del público, agenda y estados de reserva | `[Operativo / en pruebas]` |
| Gestión del sitio | Jugadores, noticias, partidos, contenido de la web, mensajes de contacto | `[Operativo / en pruebas]` |
| Usuarios y permisos | Alta de usuarios, roles por área, socios y aficionados | `[Operativo / en pruebas]` |
| Analytics | Métricas de uso y ventas | `[Operativo / en pruebas]` |

---

## 4. Objetivos y criterios de éxito

Los objetivos se redactan en formato medible. Completar las metas numéricas con
el club.

| # | Objetivo | Métrica | Meta | Fecha |
|---|---|---|---|---|
| O1 | Vender entradas en línea sin intermediarios | % de boletos vendidos por la plataforma | `[X %]` | `[dd/mm/aaaa]` |
| O2 | Reducir el tiempo de ingreso al estadio | Minutos promedio en fila / tasa de validación exitosa de QR | `[X]` | `[dd/mm/aaaa]` |
| O3 | Aumentar el ingreso por parqueo | Ingreso por partido vs. línea base | `[+X %]` | `[dd/mm/aaaa]` |
| O4 | Ordenar la relación comercial con patrocinadores | % de patrocinadores con espacios de pauta registrados | 100 % | `[dd/mm/aaaa]` |
| O5 | Generar ingreso por alquiler de salones | Reservas confirmadas por mes | `[X]` | `[dd/mm/aaaa]` |
| O6 | Operar con datos confiables | Cierre de caja diario cuadrado sin ajuste manual | 100 % | `[dd/mm/aaaa]` |

**Criterios de éxito del proyecto:** el proyecto se considera exitoso si al cierre
de la fase todos los módulos del alcance están en producción, el personal del club
opera de forma autónoma con capacitación entregada, y se cumplen las metas O1–O6
acordadas.

---

## 5. Alcance

### Dentro del alcance

- Los módulos listados en la sección 3.
- Sitio público responsive y panel administrativo.
- Cobro en línea de entradas y parqueo mediante pasarela de pagos (Stripe).
- Envío de correos transaccionales (confirmaciones, recibos, avisos al club) y
  notificaciones por WhatsApp.
- Roles y permisos por área.
- Despliegue en los ambientes de desarrollo y producción, con respaldos.
- Capacitación al personal del club y documentación de operación.

### Fuera del alcance

- Aplicaciones móviles nativas (iOS/Android).
- Integración con el ERP/contabilidad del club `[confirmar]`.
- Torniquetes o hardware de control de acceso `[confirmar]`.
- Tienda en línea de mercadería (hoy es un sitio externo).
- Migración histórica de datos anteriores a la plataforma `[confirmar]`.
- Cobro en línea del alquiler de salones (esta fase solo gestiona la solicitud
  y la agenda; el pago se coordina fuera de la plataforma).

---

## 6. Entregables

| # | Entregable | Descripción | Responsable | Fecha |
|---|---|---|---|---|
| E1 | Plataforma en producción | Todos los módulos del alcance operando en el dominio del club | `[ ]` | `[ ]` |
| E2 | Ambiente de pruebas | Entorno paralelo para validar cambios antes de producción | `[ ]` | `[ ]` |
| E3 | Manual de operación | Guía por módulo para el personal administrativo | `[ ]` | `[ ]` |
| E4 | Capacitación | Sesiones por área (taquilla, parqueo, comercial, comunicación) | `[ ]` | `[ ]` |
| E5 | Documentación técnica | Arquitectura, despliegue y respaldos | `[ ]` | `[ ]` |
| E6 | Plan de soporte post-salida | Niveles de servicio y canal de reporte de incidentes | `[ ]` | `[ ]` |

---

## 7. Hitos y cronograma

| Hito | Descripción | Fecha objetivo | Estado |
|---|---|---|---|
| H1 | Base de la plataforma (sitio, login, roles) | `[ ]` | `[Completado]` |
| H2 | Módulo de parqueo en producción | `[ ]` | `[Completado]` |
| H3 | Módulo de entradas con pago en línea | `[ ]` | `[Completado]` |
| H4 | Cuponera y restaurantes | `[ ]` | `[Completado]` |
| H5 | Patrocinadores y alquiler de salones | `[ ]` | `[Completado]` |
| H6 | Pruebas con usuarios del club (UAT) | `[ ]` | `[Pendiente]` |
| H7 | Puesta en producción de la fase | `[ ]` | `[Pendiente]` |
| H8 | Cierre y transferencia | `[ ]` | `[Pendiente]` |

---

## 8. Interesados (stakeholders) y equipo

| Rol | Persona / área | Responsabilidad | Nivel de decisión |
|---|---|---|---|
| Patrocinador del proyecto | `[ ]` | Aprueba alcance, presupuesto y cambios mayores | Alto |
| Líder de proyecto | `[ ]` | Planifica, coordina y reporta avance | Alto |
| Desarrollo | S3 Simple Software Solutions | Construye, despliega y mantiene la plataforma | Medio |
| Taquilla / boletería | `[ ]` | Usuario del módulo de entradas | Medio |
| Operación del estadio | `[ ]` | Usuario de parqueo y puerta | Medio |
| Comercial / mercadeo | `[ ]` | Usuario de patrocinadores, cuponera y salones | Medio |
| Comunicación / prensa | `[ ]` | Usuario del gestor de contenidos | Bajo |
| Restaurantes / concesionarios | `[ ]` | Dueños de locales dentro del estadio | Bajo |
| Aficionados y socios | Público | Usuarios finales del sitio | Consultivo |

---

## 9. Recursos y presupuesto

**Equipo:** `[N]` personas — `[detallar: desarrollo, diseño, QA, soporte]`.

**Infraestructura y servicios:**

| Concepto | Detalle | Costo estimado |
|---|---|---|
| Servidor / hosting | `[ ]` | `[ ]` |
| Base de datos PostgreSQL | Instancia compartida de la plataforma | `[ ]` |
| Dominio y CDN/túnel | `[ ]` | `[ ]` |
| Pasarela de pagos | Comisión por transacción (Stripe) | `[% por transacción]` |
| Correo transaccional | `[ ]` | `[ ]` |
| Mensajería WhatsApp | Twilio | `[ ]` |
| **Total estimado** | | `[₡ / US$]` |

**Presupuesto de desarrollo:** `[₡ / US$]` — `[modalidad: precio fijo por fase / bolsa de horas]`.

---

## 10. Supuestos

- El club provee a tiempo los contenidos (fotos, logos, textos, datos de
  jugadores, calendario oficial y tarifas).
- El club designa un contacto único para decisiones y aprobaciones.
- Las cuentas de la pasarela de pagos, correo y dominio están a nombre del club
  y con accesos disponibles.
- El personal del club participa en las pruebas de aceptación (UAT) y en la
  capacitación en las fechas acordadas.
- La conectividad del estadio permite validar boletos en puerta el día de partido.

---

## 11. Restricciones

- **Tecnología:** React + Vite en el frontend, Node.js/Express con TypeScript en
  el backend, PostgreSQL como base de datos, contenedores Podman y despliegue
  automatizado por GitHub Actions.
- **Calendario:** las salidas a producción deben evitar los días de partido.
- **Datos personales:** la plataforma almacena datos de aficionados y socios; debe
  cumplir la normativa costarricense de protección de datos personales
  (Ley 8968) `[validar con el asesor legal del club]`.
- **Presupuesto:** `[tope acordado]`.
- **Idioma:** toda la interfaz de usuario en español.

---

## 12. Riesgos principales

| # | Riesgo | Prob. | Impacto | Mitigación | Responsable |
|---|---|---|---|---|---|
| R1 | Los tres ambientes comparten la misma base de datos: un error en pruebas afecta datos reales | Media | Alto | Separar la base de datos de desarrollo y pruebas de la de producción antes de la salida | `[ ]` |
| R2 | Concentración del conocimiento en una sola persona de desarrollo | Alta | Alto | Documentar arquitectura y despliegue; incorporar un segundo desarrollador | `[ ]` |
| R3 | Falla de la pasarela de pagos en día de partido | Baja | Alto | Plan de contingencia de venta y cobro manual; monitoreo activo | `[ ]` |
| R4 | Hallazgos de seguridad pendientes (credenciales expuestas, endpoints sin autenticar) | Media | Alto | Cerrar los hallazgos del último análisis antes de la salida a producción | `[ ]` |
| R5 | Carga de contenidos del club llega tarde | Alta | Medio | Definir fecha límite de entrega de contenidos por hito | `[ ]` |
| R6 | Adopción baja del personal del club | Media | Medio | Capacitación por área y acompañamiento los primeros partidos | `[ ]` |
| R7 | Picos de tráfico en la venta de entradas de partidos grandes | Media | Alto | Prueba de carga previa y dimensionamiento del servidor | `[ ]` |
| R8 | Dependencia de un túnel de acceso para el despliegue | Media | Medio | Migrar el despliegue a un canal estable con IP/DNS fijo | `[ ]` |

---

## 13. Gobernanza del proyecto

- **Reuniones de avance:** `[frecuencia: semanal / quincenal]` con el patrocinador.
- **Reporte de estado:** `[formato y día]`.
- **Flujo de trabajo técnico:** el desarrollo ocurre en ramas de trabajo, se
  integra por *pull request* a la rama principal y se despliega automáticamente;
  todo cambio pasa primero por el ambiente de pruebas.
- **Control de cambios:** cualquier cambio que afecte alcance, fecha o presupuesto
  se documenta y requiere aprobación del patrocinador (ver sección 15).
- **Canal de incidentes:** `[correo / WhatsApp / herramienta]`.

---

## 14. Criterios de aceptación y cierre

El proyecto se cierra cuando:

1. Todos los entregables E1–E6 fueron entregados y aceptados por escrito.
2. Los módulos del alcance operaron en producción durante `[N]` partidos sin
   incidentes críticos.
3. El personal del club fue capacitado y opera sin asistencia permanente.
4. Los accesos, credenciales y documentación quedaron transferidos al club.
5. Se acordó el esquema de soporte y mantenimiento posterior.

---

## 15. Aprobaciones

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Patrocinador del proyecto | `[ ]` | | |
| Gerente / líder de proyecto | `[ ]` | | |
| Representante del club | `[ ]` | | |
| Proveedor (S3 Simple Software Solutions) | `[ ]` | | |

---

## 16. Control de versiones del documento

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 0.1 | `[dd/mm/aaaa]` | `[ ]` | Borrador inicial |

---

**Fuentes de la estructura:**
[Guía de acta de proyecto — Atlassian](https://www.atlassian.com/es/work-management/project-management/project-planning/project-charter) ·
[Plantilla de acta de proyecto — Confluence](https://www.atlassian.com/es/software/confluence/templates/project-charter)
