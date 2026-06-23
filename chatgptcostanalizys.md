---
name: csh-cost-profit-analysis
description: Usar este skill cuando un agente de Claude Code necesite estimar, reducir o explicar costos de desarrollo, costos de deploy, decisiones de infraestructura, tradeoffs de pasarelas de pago o prioridades de monetizacion para la aplicacion APP_CSH / Club Sport Herediano. Tambien aplica a solicitudes en ingles sobre cost analysis, deployment cost, business model, revenue, pricing, payments, profitability, hosting, Postgres, tickets, parking, sponsors, coupons, or making money from CSH.
---

# Skill De Analisis De Costos Y Ganancias CSH

## Mision

Ayudar al dueno a ganar dinero con la app del CSH sin quemar plata en infraestructura innecesaria ni en pulido infinito. Tratar cada recomendacion como una decision de negocio:

- Enviar a produccion la captura de ingresos antes que funciones bonitas.
- Mantener el costo fijo mensual de infraestructura por debajo del 2 por ciento del ingreso bruto mensual esperado hasta que exista volumen real.
- Preferir decisiones reversibles y de bajo compromiso mientras no haya trafico, ventas y riesgo de contracargos medidos.
- Nunca cotizar precios finales de memoria. Verificar precios actuales y tipo de cambio el dia del analisis.

Este skill fue preparado desde el estado del repo el 2026-06-18 en rama `dev`.

## Foto Actual Del Repo

La app es una plataforma React/Vite + Express + PostgreSQL para Club Sport Herediano:

- Frontend: React 19, Vite, React Router, `src/app-modules.jsx` como shell grande de modulos, paginas publicas/admin, mapa de estadio, mapa de parqueo, cuponera, usuarios y contenido.
- Backend: Express 5 con TypeScript en `server/`, `pg`, `nodemailer`, generacion QR, routers por dominio y bootstrap de schemas al iniciar.
- Base de datos: PostgreSQL requerido por `DATABASE_URL`; los schemas usan `create table if not exists` y `alter table ... if not exists`.
- Deploy actual: GitHub Actions despliega `dev` y `main` via SSH/ngrok hacia un host bajo `/home/tony/Desktop/APP_CSH`; systemd ejecuta `npm start`; produccion usa releases inmutables y workflow de rollback.
- Modulos de ingreso ya presentes: reservas/pagos de parqueo, entradas/ticketing con validacion QR y dashboards de ventas, cuponera/patrocinadores, contacto/admin y roles de usuarios.
- Tamano inspeccionado: cerca de 16,077 lineas en fuentes `server` y `src`.

Brecha clave de monetizacion:

- Entradas y parqueo validan un input con forma de tarjeta y guardan `payment jsonb`, pero el pago es simulado. Si `cardNumber` termina en `0000`, se rechaza; no hay captura real, webhook, settlement, reembolso ni conciliacion.
- `server/config/constants.ts` define la tarifa de parqueo como `TARIFA_HORA = 1000` CRC.
- La app esta cerca de un MVP comercial; la puerta de dinero es pago real + controles operativos.

## Supuestos Comerciales Del Proyecto

Usar estos supuestos como base cuando el usuario pida "el analisis del CSH", salvo que indique otros valores:

- Cliente/prospecto: Club Sport Herediano.
- Decisor principal: dueno del club.
- Modelo de cobro deseado: proyecto unico, no SaaS mensual.
- Meta del desarrollador: justificar al menos 5,000 USD/mes de valor economico. Si el usuario escribio "5000k", confirmar si quiso decir 5,000 USD/mes o 5,000,000 CRC/mes.
- Primer argumento de dinero: reemplazar o reducir dependencia de Passline en entradas.
- Posicionamiento: "esta app se paga sola asi..." con ahorro operativo, nuevo ingreso, control/auditoria, mejor experiencia para fans y propiedad de datos.
- Estado actual: todos los modulos son demo y requieren escrutinio profundo, testing y diseno mas robusto antes de venderse.
- MVP deseado: un poco de todo: parqueo, usuarios, ticketera/etiquetera, cuponera y patrocinadores.
- Alcance comercial inicial: solo CSH, no otros clubes.
- Escala: iniciar pequeno y escalar; no dimensionar para maxima carga desde el dia uno.
- Pagos a cotizar: BCR y Stripe.
- Service fee al comprador: no cobrarlo en la propuesta inicial.
- Capacidad de estadio: modelar 12,000 espectadores como caso conservador porque fuentes recientes del nuevo Rosabal Cordero reportan 12,000; mencionar que hay referencias viejas de 14,000-15,000 como upside.
- Parqueo: usar 400 espacios como supuesto del usuario, aunque fuentes publicas recientes mencionan "casi 500" vehiculos; mantener 400 conservador.
- Valor hora desarrollador: 50 USD/h.
- Costo de oportunidad: incluirlo aunque el desarrollador haga el trabajo.
- Techo mensual de infraestructura: 250 USD.
- Preferencia deploy: barato, con mantenimiento controlado.
- Incluir en costos: soporte, mantenimiento, backups, monitoreo, dominio, email y pasarela.
- Victoria a 90 dias: ticketera/etiquetera lista para piloto serio.

## Tabla Inicial Propuesta

Esta tabla es la propuesta inicial que el agente debe regenerar con precios frescos cuando el usuario lo pida. Esta version usa `1 USD = 455 CRC`.

### Costo De Desarrollo Para MVP Comercial

| Frente | Horas | Costo a 50 USD/h | Por que importa para vender |
| --- | ---: | ---: | --- |
| Auditoria tecnica y producto de modulos demo | 40-70 | 2,000-3,500 USD | Separar lo que sirve de lo que podria fallar frente al dueno |
| Ticketera real: compras, QR, inventario, admin ventas | 120-180 | 6,000-9,000 USD | Es el modulo que sustituye dependencia de ticketera externa |
| Pasarela BCR/Stripe: provider, webhook, conciliacion | 80-140 | 4,000-7,000 USD | Convierte demo en caja real y auditable |
| Parqueo: flujo operativo, pagos, QR, admin | 50-90 | 2,500-4,500 USD | Agrega ingreso por evento y bundle con entradas |
| Usuarios/roles/auditoria/seguridad | 50-90 | 2,500-4,500 USD | Necesario para operar con staff, puerta y admins sin desorden |
| Cuponera + patrocinadores + reportes | 50-90 | 2,500-4,500 USD | Permite vender proof-of-value a sponsors |
| Testing, QA de evento, bugs y hardening | 80-140 | 4,000-7,000 USD | Evita fallar en dia de partido |
| Diseno UX/UI comercial y responsive | 50-100 | 2,500-5,000 USD | El dueno y los fans juzgan por confianza visual |
| Deploy, backups, monitoreo y runbook | 30-60 | 1,500-3,000 USD | Hace defendible cobrar por una plataforma seria |
| **Total MVP serio** | **550-960** | **27,500-48,000 USD** | Rango defendible para proyecto unico |

Recomendacion de venta:

- No presentar esto como "solo horas de programacion".
- Presentarlo como construccion de una operacion digital de ingresos: venta, acceso, parqueo, sponsors, auditoria y datos propios.
- Si el dueno quiere reducir riesgo, proponer fase 1 de 12,000-18,000 USD enfocada en ticketera + pagos + QA de piloto.

### Costo Mensual De Operacion

| Item | Bajo | Esperado | Alto | Nota |
| --- | ---: | ---: | ---: | --- |
| VPS app + Postgres autogestionado | 10 USD | 20 USD | 40 USD | Opcion barata; requiere backups bien hechos |
| Backups externos / storage | 2 USD | 10 USD | 25 USD | R2/B2/S3, retencion y restore drill |
| Email transaccional | 0 USD | 20 USD | 35 USD | Resend/Postmark o SMTP; tickets y recibos suben volumen |
| Monitoreo/errores | 0 USD | 26 USD | 80 USD | Free al inicio, plan pagado al crecer |
| Dominio/DNS/TLS | 1 USD | 2 USD | 5 USD | Prorrateado mensual |
| ngrok/VPS/IP fijo | 8 USD | 20 USD | 50 USD | Si se mantiene tunel; mejor VPS/IP para dinero publico |
| Mantenimiento tecnico mensual | 500 USD | 1,500 USD | 3,000 USD | Soporte, parches, eventos, incidentes |
| **Total mensual defendible** | **521 USD** | **1,598 USD** | **3,235 USD** | Infra pura puede quedar bajo 250 USD; soporte es aparte |

Regla para el dueno:

- Infraestructura pura debe mantenerse bajo 250 USD/mes al inicio.
- El mantenimiento no es "hosting"; es seguro operativo para dias de venta y partido.

### Justificacion De Ingresos: Ticketera

Usar capacidad conservadora de 12,000 espectadores. No prometer lleno total. Modelar adopcion por fases.

| Escenario | Entradas vendidas/evento | Precio promedio | Eventos/mes | Bruto vendido/mes |
| --- | ---: | ---: | ---: | ---: |
| Piloto | 1,000 | 7,500 CRC | 2 | 15,000,000 CRC |
| Medio | 4,000 | 7,500 CRC | 2 | 60,000,000 CRC |
| Fuerte | 8,000 | 7,500 CRC | 2 | 120,000,000 CRC |
| Lleno conservador | 12,000 | 7,500 CRC | 2 | 180,000,000 CRC |

Si no se cobra service fee al comprador:

- El ahorro directo no siempre aparece como ingreso del club si la ticketera externa cobra el fee al fan.
- La jugada comercial es mantener o bajar el precio final al fan y capturar parte de lo que antes era fee externo dentro del precio base del club.
- Ejemplo: si una ticketera externa encarece el final 10-15 por ciento, una entrada de 7,500 CRC puede terminar costando 8,250-8,625 CRC al fan. CSH podria vender a 8,000 CRC dentro de su propia app: el fan paga menos, el club captura 500 CRC extra por entrada, y el dato queda en casa.

| Escenario | Extra capturado si CSH sube 500 CRC sin subir precio final percibido | USD aprox |
| --- | ---: | ---: |
| 1,000 entradas * 2 eventos | 1,000,000 CRC/mes | 2,198 USD |
| 4,000 entradas * 2 eventos | 4,000,000 CRC/mes | 8,791 USD |
| 8,000 entradas * 2 eventos | 8,000,000 CRC/mes | 17,582 USD |
| 12,000 entradas * 2 eventos | 12,000,000 CRC/mes | 26,374 USD |

Conclusion para pitch:

```text
Con solo capturar 500 CRC por entrada que antes se perdian en friccion/fee externo,
la app puede justificar mas de 5,000 USD mensuales a partir de ~4,600 entradas al mes.
```

### Justificacion De Ingresos: Parqueo

Usar 400 espacios como supuesto conservador del usuario.

| Escenario | Espacios vendidos | Precio/evento | Eventos/mes | Bruto mensual |
| --- | ---: | ---: | ---: | ---: |
| Piloto | 100 | 3,000 CRC | 2 | 600,000 CRC |
| Medio | 250 | 4,000 CRC | 2 | 2,000,000 CRC |
| Fuerte | 400 | 4,000 CRC | 2 | 3,200,000 CRC |
| Fuerte con bundle | 400 | 5,000 CRC | 3 | 6,000,000 CRC |

El parqueo no paga toda la app solo al inicio, pero ayuda a financiar operacion y mejora la experiencia del aficionado.

### Costos De Pago A Modelar

| Proveedor | Uso en propuesta | Costo de planeacion | Advertencia |
| --- | --- | ---: | --- |
| BCR Web Checkout / soluciones BCR | Opcion local preferida a cotizar | 2.5%-3.5% estimado hasta cotizar | BCR indica que comision varia por giro/facturacion; requiere promotor |
| Stripe | Solo si hay entidad soportada o via estructura legal compatible | 2.9% + 0.30 USD domestic US; +1.5% internacional; +1% conversion si aplica | Costa Rica no aparece en lista standard de paises soportados al 2026-06-18 |
| Mock provider | Testing y demo | 0 | Nunca usar como pago real |

Para el pitch:

- BCR es mas defendible para CSH por cuenta local, colones y adquirencia local.
- Stripe puede ser excelente tecnicamente, pero puede complicar legal/fiscal si el comercio es costarricense.
- La arquitectura debe permitir cambiar proveedor sin reescribir ticketera/parqueo.

### Frase Ejecutiva Para El Dueno

```text
Esta app se paga sola si dejamos de regalar la relacion con el aficionado:
vendemos entradas, validamos accesos, cobramos parqueo, medimos sponsors y nos quedamos con los datos.
Aunque no cobremos service fee, con capturar solo 500 CRC por entrada dentro del precio base,
un mes medio de 4,000 entradas por dos eventos genera unos 4,000,000 CRC adicionales,
aprox. 8,800 USD. Eso paga mantenimiento, infraestructura y amortiza el desarrollo.
```

## Como Usar Este Skill En Claude Code

1. Partir de la verdad del repo:
   - Leer `AGENTS.md`, `CLAUDE.md`, `docs/harness.md`, `package.json`, `.env.example`, `README.md` y `.github/workflows/*.yml`.
   - No leer `.env`, `ALL_SECRETS` ni archivos de secretos reales salvo que el usuario lo pida explicitamente y sea necesario.
   - Inspeccionar `server/modules/parqueo`, `server/modules/entradas`, `server/modules/cuponera`, `server/modules/usuarios` y `src/app-modules.jsx` para cambios de ingresos.

2. Refrescar datos de mercado antes de dar presupuesto:
   - Hosting: Render, DigitalOcean, VPS, o el proveedor que el usuario nombre.
   - Base de datos: PostgreSQL administrado o PostgreSQL autogestionado.
   - Email: Resend, Postmark, SMTP del club u otro proveedor elegido.
   - Pagos: priorizar opciones compatibles con Costa Rica; no asumir que Stripe esta disponible para una empresa costarricense.
   - Tipo de cambio: usar BCCR u otra fuente confiable y redondear para planeacion.

3. Separar costos en tres capas:
   - Costo fijo mensual de infraestructura.
   - Presupuesto unico de desarrollo/endurecimiento.
   - Costo variable por transaccion y margen de contribucion.

4. Cerrar con una recomendacion enfocada en dinero:
   - Que construir ahora.
   - Que aplazar.
   - Que medir.
   - Que meta de ingreso paga el trabajo.

## Tipo De Cambio Para Planeacion

Usar una tasa viva antes de estimaciones finales. El 2026-06-18, fuentes publicas mostraban aproximadamente 453-455 CRC por USD, y referencias de venta del BCCR alrededor de media tabla de los 450s CRC/USD. Para planeacion:

```text
1 USD = 455 CRC
```

Siempre mostrar la fecha del tipo de cambio en las notas de entrega.

## Bases De Costo De Deploy

Usar estos rangos como punto de partida, no como cotizacion permanente. Actualizarlos antes de comprar.

| Opcion | Costo mensual estimado | Mejor uso | Riesgo |
| --- | ---: | --- | --- |
| Self-host actual + GitHub Actions + ngrok | 0-50 USD | Menor quema de caja mientras se valida pago e uso interno | Internet local/oficina, limites del tunel, uptime mas debil |
| VPS con app + PostgreSQL autogestionado | 8-35 USD | Produccion austera si alguien mantiene Linux, backups y monitoreo | Carga operativa, riesgo de recuperacion de DB |
| VPS app + PostgreSQL administrado | 25-70 USD | Buen primer entorno pagado de produccion | Costo fijo un poco mayor, pero simple |
| PaaS tipo Render | 30-100+ USD | Deploy rapido y menos operaciones | Workspace + compute + DB puede subir rapido |
| Cloud con alta disponibilidad | 150-500+ USD | Solo cuando ingresos o evento critico justifiquen uptime fuerte | Exceso antes de tener volumen |

Anclas de precios revisadas en 2026:

- DigitalOcean Droplets empiezan en 4 USD/mes; PostgreSQL administrado empieza cerca de 15.15 USD/mes por 1 GiB / 1 vCPU.
- Render Web Service Starter cuesta 7 USD/mes; Standard 25 USD/mes; Render Postgres Basic empieza en 6 USD/mes para 256 MB y 19 USD/mes para 1 GB; Pro workspace cuesta 25 USD/mes mas compute.
- ngrok Free trae endpoints, transferencia y requests limitados; Hobbyist cuesta 8 USD/mes anual o 10 USD mensual; Pay-as-you-go empieza en 20 USD/mes mas uso y permite dominio propio.
- Resend email transaccional: Free tiene 3,000 emails/mes con limite 100/dia; Pro empieza en 20 USD/mes por 50,000 emails.
- Cloudflare R2 storage: 0.015 USD/GB-mes en storage standard, mas cargos de requests.

Recomendacion practica:

- Mantener el deploy actual dev/prod mientras se termina captura real de pago y disciplina de backups.
- Mover produccion a VPS fijo o PaaS administrado solo cuando exista un piloto de pago real calendarizado.
- Si se usa el tunel actual para dinero publico, presupuestar ngrok Pay-as-you-go o reemplazarlo con VPS/IP real antes del lanzamiento.

## Estimacion De Costo De Desarrollo

Asumir un senior full-stack o un operador senior con asistencia de IA. Reemplazar tarifas por cotizaciones reales cuando se contrate.

| Alcance | Horas | Rango a 45-85 USD/h | Proposito |
| --- | ---: | ---: | --- |
| MVP de pago en produccion | 80-160 | 3,600-13,600 USD | Gateway real, sandbox, captura, estados fallidos, recibos, conciliacion |
| Endurecimiento de lanzamiento | 60-120 | 2,700-10,200 USD | Backups, monitoreo, logs, env hardening, auditoria admin, smoke tests |
| Dashboards de ingresos y prueba para sponsors | 50-100 | 2,250-8,500 USD | Reportes de ventas, valor de redenciones, exports para sponsors |
| Pulido comercial de entradas/parqueo | 80-180 | 3,600-15,300 USD | UX, escaneo QR, reembolsos, operacion, soporte |
| Plataforma desde estado actual hasta produccion seria | 180-360 | 8,100-30,600 USD | Presupuesto realista desde este repo |
| Valor de reemplazo desde cero | 600-1,000 | 27,000-85,000 USD | No reconstruir salvo que el repo se abandone |

Regla de dinero:

No gastar el presupuesto completo de plataforma antes de validar al menos un evento pagado. Invertir los primeros 5k-15k USD solo en el camino mas corto para aceptar dinero real, emitir QR validos, conciliar ventas y probar demanda de sponsors/parqueo.

## Guia De Pasarela De Pago

El codigo ya tiene forma para `PaymentRecord`, recibos, ordenes de tickets, recibos de parqueo y envio de correos. Agregar una abstraccion de proveedor en vez de pegar un gateway directo en rutas.

Arquitectura sugerida:

```text
server/modules/payments/
  payments.provider.ts
  payments.types.ts
  providers/tilopay.ts
  providers/kushki.ts
  providers/paypal.ts
  providers/mock.ts
```

Estados requeridos:

- `created`
- `authorized`
- `captured`
- `failed`
- `refunded`
- `chargeback`
- `manual_review`

Reglas de seleccion de proveedor:

- Comercio costarricense: investigar Tilopay, Kushki, BAC/Banco Nacional acquiring, PayPal y cualquier procesador local ya aprobado por el club.
- Stripe: no asumir disponibilidad para una empresa costarricense. La lista oficial de paises de Stripe al 2026-06-18 no incluia Costa Rica para pagos standard. Una entidad en EE.UU. via Stripe Atlas cambia la estructura legal/fiscal y debe ser decision de negocio.
- No guardar tarjetas crudas. Usar checkout hospedado, tokenizacion o UI del proveedor cuando sea posible. El formulario fake actual no debe convertirse en manejo de tarjetas de produccion.

Modelo de costo variable:

```text
payment_fee = gross_amount * processor_percent + transaction_count * fixed_fee
net_revenue = gross_amount - payment_fee - refunds - chargebacks - support_cost - tax_withholding
```

Para planeacion en Costa Rica, usar un costo conservador de tarjeta de 2.8-4.0 por ciento hasta firmar contrato de adquirencia.

## Modelo De Ingresos

### Parqueo

Tarifa actual en codigo: 1,000 CRC/hora.

Formula:

```text
parking_gross = espacios_vendidos * horas_promedio_pagadas * dias_evento_por_mes * 1000 CRC
```

Ejemplos a 455 CRC/USD:

| Escenario | Bruto mensual | USD aprox |
| --- | ---: | ---: |
| 50 espacios * 3h * 4 dias de evento | 600,000 CRC | 1,319 USD |
| 100 espacios * 4h * 4 dias de evento | 1,600,000 CRC | 3,516 USD |
| 150 espacios * 4h * 5 dias de evento | 3,000,000 CRC | 6,593 USD |

Palancas de ganancia:

- Subir tarifa de dia de evento sobre la tarifa normal cuando la demanda supere capacidad.
- Vender paquetes prepago de parqueo para socios.
- Reservar espacios accesibles y premium con precio transparente.
- Agregar reglas de no-show y ventanas de corte.

### Entradas

Formula:

```text
ticket_gross = entradas_vendidas * precio_promedio_entrada
processor_cost = ticket_gross * payment_rate + orders * fixed_fee
platform_margin = ticket_gross * platform_fee_percent
```

Ejemplo:

```text
1,500 entradas * 7,500 CRC * 2 eventos = 22,500,000 CRC bruto/mes
Con 3 por ciento de procesamiento = 675,000 CRC/mes
Si la plataforma captura 3 por ciento de fee = 675,000 CRC/mes
```

Palancas de ganancia:

- Agregar cargo de servicio por entrada o porcentaje.
- Agregar preventas financiadas por sponsors.
- Empaquetar entrada + parqueo + cupon.
- Vender modulo white-label de eventos a otros venues solo despues de estabilizar CSH.

### Cuponera Y Sponsors

La app ya tiene cupones ligados a sponsors, conteo de usos y roles de sponsor. Monetizar prueba, no solo logos.

Paquetes comerciales sugeridos:

- Cupon sponsor basico: 150,000-250,000 CRC/mes por oferta listada y reporte de uso.
- Campana sponsor destacada: 350,000-750,000 CRC/mes con posicion en home, empuje en dia de evento y reporte de redenciones.
- Campana por performance: retainer base mas costo por redencion verificada.

Datos necesarios antes de cobrar mas:

- Vistas de cupon.
- Redenciones.
- Redencion por evento/fecha.
- Estimacion de venta incremental para sponsor.
- Reporte exportable para sponsor.

### Membresias / Socios

Los perfiles de usuarios ya tienen metricas tipo membresia: asistencia, entradas, gasto, cupones, parqueo y puntos.

Movidas de dinero:

- Parqueo prioritario para membresias pagadas.
- Acceso temprano a entradas.
- Cupones desbloqueados por tier.
- Puntos de fidelidad atados a compras reales.

## Roadmap Enfocado En Dinero

### Fase 1 - 7 a 14 dias

Meta: que la app pueda aceptar dinero real de forma segura en un piloto.

- Escoger un proveedor de pago compatible con Costa Rica y sandbox.
- Agregar abstraccion de pagos y mantener proveedor mock para tests.
- Reemplazar exito fake de tarjeta con checkout/token flow del proveedor.
- Guardar transaction id del proveedor, status, monto, moneda y metadata cruda del evento.
- Agregar pantalla admin de conciliacion de pagos.
- Agregar script de backup y ensayo de restore para PostgreSQL.
- Agregar log basico de eventos de ingreso para entradas, parqueo, cupones y reembolsos.

No gastar tiempo aqui en:

- Nuevas landing pages.
- Redisenos cosmeticos.
- Mas data demo.
- Reescribir auth.

### Fase 2 - 15 a 30 dias

Meta: correr un evento pagado sin caos manual de hojas de calculo.

- Endurecer validacion QR para operadores de puerta.
- Agregar flujos de reembolso/cancelacion.
- Agregar cierre diario de ventas.
- Agregar reportes de redencion para sponsors/cupones.
- Agregar auditoria admin para ediciones de precio, stock y pagos.
- Agregar monitoreo de uptime y errores.

### Fase 3 - 31 a 60 dias

Meta: aumentar ingreso promedio por aficionado.

- Bundles de entrada + parqueo.
- Ofertas de sponsor adjuntas a entradas compradas.
- Tiers de membresia con ventanas prioritarias.
- Recuperacion de checkout abandonado donde sea legal.
- Export contable.

## Reglas De Control De Costos

- Mantener una sola base PostgreSQL hasta que la carga medida demuestre lo contrario.
- No agregar Redis/colas salvo que retries de email/pagos generen presion real.
- No pagar alta disponibilidad antes de que el ingreso por evento la justifique. Backups y restore drills van primero.
- Usar base administrada cuando el costo de perder datos sea mayor que 15-30 USD/mes.
- Tratar cada hora manual en dia de evento como costo. Construir herramientas admin que eliminen trabajo repetido.
- Definir techo mensual de costo antes de agregar suscripciones SaaS.

## Plantilla De Estimacion

Usar esta estructura al responder al dueno:

```md
## Recomendacion
Una frase: que comprar/construir ahora y que aplazar.

## Costo Mensual
| Item | Bajo | Esperado | Alto | Notas |
| --- | ---: | ---: | ---: | --- |

## Presupuesto De Desarrollo
| Frente | Horas | Costo | Impacto en ingresos |
| --- | ---: | ---: | --- |

## Punto De Equilibrio
monthly_fixed_cost = ...
average_margin_per_order = ...
orders_to_break_even = ...

## Movidas Para Hacer Dinero
1. ...
2. ...
3. ...

## Riesgos
- ...

## Validacion / Fuentes
- Precios revisados el YYYY-MM-DD desde ...
```

## Fuentes Revisadas El 2026-06-18

- Formato de skills Claude Code: https://code.claude.com/docs/en/skills
- Ejemplos Anthropic skills y frontmatter requerido: https://github.com/anthropics/skills
- DigitalOcean Droplets pricing: https://www.digitalocean.com/pricing/droplets
- DigitalOcean Managed Databases pricing: https://www.digitalocean.com/pricing/managed-databases
- Render pricing: https://render.com/pricing
- Neon pricing: https://neon.com/pricing
- ngrok pricing: https://ngrok.com/pricing
- Resend pricing: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Referencia BCCR: https://www.bccr.fi.cr/
- Disponibilidad global Stripe: https://stripe.com/global
- Stripe pricing: https://stripe.com/pricing
- Terminos/API/pasarela Tilopay: https://connect.tilopay.com/terms-and-conditions/
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- BCR soluciones de aceptacion de pago: https://www.bancobcr.com/wps/portal/bcr/bancobcr/comercios_afiliados/
- BCR Web Checkout: https://www.bancobcr.com/wps/portal/bcr/bancobcr/soporte/pagos
- Estadio Rosabal Cordero capacidad/proyecto: https://estadiosdb.com/proyectos/crc/estadio_eladio_rosabal_cordero
- Nota reciente sobre nuevo estadio, capacidad y parqueos: https://futbolcentroamerica.com/costarica/cuando-se-va-a-inaugurar-el-estadio-de-herediano-fecha-y-detalles-del-nuevo-eladio-rosabal-cordero
- Rangos generales de PSP en Costa Rica: https://payatlas.com/countries/costa-rica-cr
- Passline productores: https://producers.passline.com/
- Passline blog/tips: https://blog.passline.com/category/tips/

## Checklist De Entrega

Antes de dar una recomendacion final de negocio:

- Confirmar rama y worktree.
- Confirmar si el usuario quiere self-hosting actual, VPS o PaaS administrado.
- Actualizar precios de proveedores y tipo de cambio.
- Identificar que pasarela puede usar legalmente el club.
- Estimar costo fijo mensual, costo variable por transaccion y costo unico de desarrollo.
- Mostrar el primer hito de ingreso que paga el trabajo.
- Si hubo cambios de codigo, correr tests focalizados, `npm run check`, y `npm run build:server` cuando se toque server.
