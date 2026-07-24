---
id: US-0045
issue: 45
issue_url: https://github.com/S3-Simple-Software-Solutions/CSH/issues/45
stage: Backlog
generated_at: 2026-07-24T23:16:31.723Z
---

# US-0045: Diagramas de arquitectura en Mermaid

## Issue de origen

- Número: 45
- URL: https://github.com/S3-Simple-Software-Solutions/CSH/issues/45
- Autor: anthonyOviedo

## Problema

Actualmente, la aplicación no cuenta con diagramas que permitan visualizar su arquitectura, infraestructura y flujo de CI/CD. Esto dificulta que desarrolladores y stakeholders revisen rápidamente el estado de la solución, comprendan cómo está construida e identifiquen posibles puntos de mejora o escalabilidad.

## User story

**Como** desarrollador, **quiero** consultar diagramas de la arquitectura de la aplicación, la infraestructura y el flujo de CI/CD en un archivo Markdown con Mermaid, **para** comprender y revisar rápidamente cómo está construida la solución.

**Como** stakeholder, **quiero** consultar una representación visual y resumida de la solución, **para** conocer su estado e identificar posibles puntos de mejora o escalabilidad.

## Alcance

Incluye:

- Crear un archivo Markdown con diagramas Mermaid.
- Representar la arquitectura de la aplicación.
- Representar la infraestructura.
- Representar el flujo de CI/CD.
- Mantener los diagramas cortos y utilizar únicamente títulos como contenido textual.
- Utilizar varios colores en los diagramas.
- Actualizar los diagramas conforme se incorporen cambios de desarrollo a `main`.

Queda fuera:

- Documentación textual detallada de los componentes.
- Descripciones técnicas dentro de los diagramas que no sean títulos.
- Diagramas de áreas distintas de la aplicación, la infraestructura y CI/CD.

## Criterios de aceptación

- [ ] El repositorio contiene un nuevo archivo con extensión `.md` que incluye sintaxis Mermaid válida.
- [ ] El archivo contiene un diagrama de la arquitectura de la aplicación.
- [ ] El archivo contiene un diagrama de la infraestructura.
- [ ] El archivo contiene un diagrama del flujo de CI/CD.
- [ ] Los elementos visibles de los diagramas utilizan únicamente títulos, sin párrafos ni descripciones adicionales.
- [ ] Los diagramas emplean al menos dos colores visualmente distintos.
- [ ] Los diagramas pueden renderizarse sin errores en un visor compatible con Mermaid.
- [ ] Los componentes y relaciones mostrados corresponden al estado actual del repositorio y de su configuración.
- [ ] Los diagramas están actualizados después de incorporar a `main` cambios que modifiquen la arquitectura, infraestructura o CI/CD.

## Casos borde

- Un cambio de desarrollo no modifica la arquitectura, infraestructura ni CI/CD y, por lo tanto, no requiere cambios en los diagramas.
- Un componente participa en más de una de las áreas documentadas.
- La plataforma utilizada para consultar el archivo no soporta Mermaid o no admite todas sus opciones de color.
- La configuración existente no permite determinar con claridad una relación entre componentes.
- Un cambio llega a `main` sin que se hayan actualizado los diagramas afectados.

## Dependencias

- Acceso a la estructura y componentes actuales de la aplicación.
- Acceso a la definición vigente de la infraestructura.
- Acceso a la configuración actual del flujo de CI/CD.
- Un visor o plataforma compatible con Mermaid.
- El proceso mediante el cual los cambios de desarrollo se incorporan a `main`.

## Preguntas abiertas

- ¿Cuál debe ser el nombre y la ubicación del nuevo archivo?
- ¿Los tres diagramas deben estar en un único archivo o pueden separarse?
- ¿Qué nivel de detalle se considera suficientemente corto?
- ¿Qué componentes y relaciones deben aparecer en cada diagrama?
- ¿Existe una paleta de colores institucional que deba utilizarse?
- ¿La actualización al pasar cambios de desarrollo a `main` será manual o automatizada?
- ¿Qué evento concreto significa “cada move de dev a main”: un merge, un despliegue u otro paso?
- ¿Quién debe verificar que los diagramas permanezcan actualizados?

## Primer paso sugerido

Crear el archivo Markdown con una primera versión mínima del diagrama de arquitectura de la aplicación, usando Mermaid, únicamente títulos y varios colores, y validarlo contra la estructura actual del repositorio.
