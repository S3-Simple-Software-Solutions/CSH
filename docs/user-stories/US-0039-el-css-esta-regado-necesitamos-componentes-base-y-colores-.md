---
id: US-0039
issue: 39
issue_url: https://github.com/S3-Simple-Software-Solutions/CSH/issues/39
stage: Backlog
generated_at: 2026-07-24T21:46:13.818Z
---

# US-0039: Componentes base y sistema de diseño unificado (colores, tipografías, botones, campos, tablas, modales)

## Source Issue
- Issue number: 39
- Issue URL: https://github.com/S3-Simple-Software-Solutions/CSH/issues/39
- Author: anthonyOviedo

## Expanded Problem
El frontend de CSH acumuló estilos en archivos grandes y poco organizados (`styles.css`, `site.css`, miles de líneas) sin una fuente única de verdad para colores, tipografías ni componentes visuales. Cada pantalla nueva copia y adapta estilos existentes en lugar de reutilizar componentes, lo que ya produjo inconsistencias visibles (el rojo institucional del Herediano aparece en al menos tres tonos distintos entre pantallas). Además, no hay garantía de comportamiento responsive: existen pantallas que se rompen en celular.

Este problema es de deuda técnica con impacto directo en producto: sin una base de componentes y tokens de diseño, cada módulo nuevo que se agregue (los que están planeados a futuro) incrementará la inconsistencia visual y el costo de mantenimiento, y hará cada vez más cara la eventual migración a un sistema ordenado.

## User Story
Como desarrollador del equipo CSH, quiero un conjunto de componentes base (botones, campos, tablas, modales) y tokens de diseño (colores, tipografías) centralizados, para poder construir pantallas nuevas de forma consistente y sin duplicar ni adivinar estilos.

Como usuario final del club (staff administrativo, entrenadores, jugadores según el módulo), quiero que la aplicación se vea visualmente consistente y funcione bien en celular, para poder usarla sin confusión ni errores de visualización sin importar la pantalla o dispositivo.

## Inputs
- Estilos actuales en `styles.css` y `site.css` (y cualquier otro CSS disperso en el proyecto).
- Guía de marca del Herediano (si existe) o, en su defecto, los tonos de rojo actualmente en uso para elegir uno canónico.
- Inventario de pantallas existentes y sus breakpoints problemáticos en mobile.

## Outputs
- Un archivo (o módulo) de tokens de diseño: paleta de colores (incluyendo el rojo institucional único), tipografías, espaciados básicos.
- Una librería/carpeta de componentes base reutilizables: botón, campo de formulario (input/select/textarea), tabla, modal.
- Documentación mínima de uso de estos componentes (README o comentario de referencia) para que el equipo sepa cómo aplicarlos en pantallas nuevas.
- Al menos una pantalla existente migrada como prueba de concepto usando los nuevos componentes.

## Functional Requirements
- Definir variables/tokens centralizados de color (incluir explícitamente el rojo institucional del Herediano en un único valor) y tipografía, consumibles desde cualquier pantalla.
- Construir componente de botón con sus variantes de uso común (primario, secundario, deshabilitado, etc. — a validar con diseño/negocio).
- Construir componente de campo de formulario con estados (normal, focus, error, deshabilitado).
- Construir componente de tabla base reutilizable para listados.
- Construir componente de modal base reutilizable.
- Los componentes deben ser responsive por defecto (mobile-first o al menos verificado en los breakpoints usados por la app).
- Reemplazar en al menos una pantalla real los estilos ad-hoc actuales por los nuevos componentes, como validación de que el sistema funciona en la práctica.

## Non-Functional Requirements
- No se debe romper la funcionalidad ni el aspecto visual de las pantallas que no se migren en esta iteración (backwards compatibility mientras dura la migración gradual).
- El sistema de componentes debe quedar documentado lo suficiente para que otro desarrollador del equipo pueda adoptarlo sin tener que preguntar.
- Los estilos deben mantenerse dentro de las convenciones tecnológicas ya usadas en el proyecto (no introducir un framework CSS nuevo sin acordarlo antes, ver Open Questions).
- Rendimiento: no se debe incrementar significativamente el peso de CSS cargado por pantalla respecto al estado actual.

## Acceptance Criteria
- [ ] Existe un único lugar en el código donde se definen los colores institucionales (incluyendo el rojo del Herediano) y las tipografías, y ese lugar es la única fuente de verdad (sin valores hardcodeados nuevos fuera de ahí).
- [ ] Existen componentes reutilizables de botón, campo de formulario, tabla y modal, documentados y ubicados en una carpeta/módulo identificable.
- [ ] Al menos una pantalla de la aplicación fue migrada para usar estos componentes y los tokens de color/tipografía, y se ve correctamente en desktop y mobile.
- [ ] Las pantallas migradas no muestran roturas de layout en los tamaños de pantalla mobile probados (a definir cuáles, ver Open Questions).
- [ ] El rojo institucional se ve idéntico (mismo valor hex) en todas las pantallas que lo usan tras la migración.
- [ ] No se detectan regresiones visuales o funcionales en las pantallas no migradas.

## Edge Cases
- Pantallas que usan estilos muy específicos o "one-off" que no encajan limpiamente en los componentes base (definir si se fuerzan al estándar o quedan como excepción documentada).
- Modales anidados o múltiples modales abiertos simultáneamente.
- Tablas con gran cantidad de columnas en viewport mobile (scroll horizontal vs. colapso de columnas).
- Campos de formulario con validaciones existentes que dependan de clases CSS específicas que se estén reemplazando.
- Componentes usados dentro de iframes o contextos con CSS aislado, si aplica en el proyecto.

## Dependencies
- Definición de marca/guía de estilo oficial del Herediano (si existe un documento de identidad visual, debería usarse como referencia para elegir el rojo canónico y tipografías).
- Coordinación con cualquier módulo en desarrollo paralelo que esté generando CSS nuevo, para evitar más duplicación mientras se hace esta base.
- Acceso/contexto sobre qué pantallas son prioritarias para la migración de prueba de concepto.

## Open Questions
- ¿Existe ya una guía de marca oficial del Herediano con el código de color exacto, o hay que decidirlo internamente entre los tonos actuales?
- ¿Se va a adoptar una metodología/herramienta específica (CSS variables nativas, SCSS, alguna librería de componentes) o se construye todo a medida sobre el stack actual?
- ¿Cuáles son los breakpoints/dispositivos mobile prioritarios a soportar (ancho mínimo, dispositivos de referencia del staff/usuarios)?
- ¿Esta tarea cubre solo la base de componentes, o también incluye migrar todas las pantallas existentes (el issue sugiere que es una base para lo que viene, no necesariamente una migración completa)?
- ¿Quién valida el resultado visual final (diseño, negocio, el propio equipo dev)?

## Suggested First Slice
Definir y centralizar los tokens de color y tipografía (incluyendo el rojo institucional único) y construir el componente de botón como primer componente base, migrando una pantalla pequeña y de bajo riesgo como prueba de concepto end-to-end del enfoque, antes de invertir en campos, tablas y modales.
