# Roles de agente

Hoy existe **uno**. El resto de esta página es inventario de lo que podría
hacer falta, no un plan comprometido.

Un rol se agrega cuando hay un trabajo repetido que hoy hace un humano y que
se puede juzgar con un comando. Si no se puede juzgar, no es un rol de
agente: es una opinión con más pasos.

## Implementador — el único implementado

Toma una story y produce un diff que pasa los gates.

**Input**

- Un número de issue con label `agent-ready` que pasa el contrato de entrada
  ([HARNESS.md](HARNESS.md)).
- `CLAUDE.md` completo.
- Los comandos exactos de los gates que se le van a correr.
- En un reintento: el nombre del gate que falló y su salida recortada.

**Output**

- Cambios en el working tree de un `git worktree` desechable.
- Un mensaje final: qué cambió, qué verificó, qué quedó sin verificar.
  Se guarda en el trace como **dato**, nunca como veredicto.

**Límites**

- Solo escribe bajo `app/`.
- No ejecuta git más allá de leer estado. No commitea, no pushea, no abre
  PR, no cambia de rama.
- No modifica tests preexistentes ni migraciones ya aplicadas.
- No agrega dependencias que la story no pida.
- Máximo 3 intentos (2 reintentos). Después, la corrida aborta.

**Modelo:** `opus`, vía el CLI de `claude` como sub-proceso.

**Cómo se sabe si hizo bien el trabajo:** no se le pregunta a él. Los cuatro
gates de [VERIFICATION.md](VERIFICATION.md), corridos por el harness sobre
el árbol final.

## Fase futura — no implementados

Ninguno de estos existe. Están acá para que la discusión empiece de una
lista y no de cero.

### Refinador de stories

Convierte un issue crudo en una story que pase el contrato de entrada, o
explica por qué no se puede.

- *Input:* issue sin `agent-ready`.
- *Output:* comentario en el issue con la story reescrita, para aprobación
  humana.
- *Límite:* no toca código; no se pone el label a sí mismo.
- *Nota:* hay algo de esto en `scripts/issue-userstory.mjs`, que ya corre
  desde `.github/workflows/issue-userstory.yml`. Antes de escribir un rol
  nuevo, decidir si se absorbe ese.

### QA

Escribe tests para código que ya existe, sin cambiar comportamiento.

- *Input:* un módulo sin cobertura.
- *Output:* archivos `*.test.ts` nuevos.
- *Límite:* **solo** agrega archivos de test; si necesita tocar código de
  producción para hacerlo testeable, eso es trabajo del implementador y hay
  que abrir otra story.
- *Pendiente:* hoy no hay gate de cobertura, así que no habría forma de
  juzgarlo. Eso primero.

### Revisor

Lee el diff de un PR agéntico y comenta lo que los gates no atrapan:
convenciones, casos borde, decisiones raras.

- *Límite duro:* comenta, no aprueba y no mergea.
- *Pendiente:* su salida es prosa, no exit code — hay que decidir cómo se
  mide si sirve, o se vuelve ruido que nadie lee.

### Infra

Deploy, entornos, rollback.

- *Pendiente, y el más delicado:* toca cosas fuera de `app/`, que es
  exactamente lo que el gate de alcance bloquea hoy. Requiere repensar esa
  regla, no solo agregar un rol.

## Por qué se empieza con uno

Cada rol nuevo agrega un traspaso, y cada traspaso es donde se pierde
contexto. Con un solo agente y un juez externo, cuando algo sale mal hay dos
sospechosos. Con cuatro agentes encadenados hay que reconstruir quién le
pasó qué a quién antes de empezar a mirar.

El implementador tiene que andar aburridamente bien antes de que valga la
pena sumar el segundo.

## Nota sobre este archivo

Existe también `AGENTS.md` en la raíz del repo, que es la convención que
leen otras herramientas (Codex, Cursor). Ese apunta acá; el contenido vive
en este documento.
