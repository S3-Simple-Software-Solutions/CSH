# Sistema agéntico del CSH

Cómo se implementa una story sin que un humano escriba el código, y por qué
está armado así.

La idea es una sola: **un bucle cerrado**. El agente cambia código, un juez
externo corre comandos reales, el resultado vuelve al agente. Todo lo demás
—prompts, contexto, notificaciones— es accesorio. Si el bucle no cierra, no
hay sistema agéntico; hay un generador de texto con acceso a disco.

## Quién decide qué

La división no es por dificultad, es por **conflicto de interés**. El agente
decide todo lo que es criterio técnico. El harness decide todo lo que
determina si el agente tuvo éxito.

| Decisión | Quién | Por qué |
|---|---|---|
| Qué archivos leer | Agente | Es exploración; el harness no sabe dónde está el problema |
| Qué archivos editar y cómo | Agente | Es el trabajo |
| Cómo estructurar la solución | Agente | Criterio técnico |
| Cuándo terminó de editar | Agente | Solo él sabe si le falta algo |
| **Si la story es ejecutable** | Harness | Un agente siempre va a intentar |
| **Qué contexto recibe el agente** | Harness | Reproducibilidad |
| **Dónde trabaja el agente** | Harness | Aislamiento |
| **Si el trabajo pasó** | Harness | El agente no puede calificarse |
| **Si el diff está en alcance** | Harness | El agente no ve su propio sesgo |
| **Si se reintenta o se aborta** | Harness | Evita el bucle infinito |
| **Si se abre PR** | Harness | Es la acción irreversible |

Regla práctica: **el agente nunca ejecuta git más allá de leer estado.** No
commitea, no pushea, no abre PR, no cambia de rama. Si el agente pudiera
abrir el PR, el juez sería opcional.

## El loop

```
0. INTAKE      gh issue view <n>
               ¿tiene label agent-ready? ¿tiene criterios de aceptación?
               NO -> abortar sin tocar nada, comentar en el issue

1. SANDBOX     git worktree add .harness-runs/<runId>/tree -b agent/<n>-<slug>
               desde dev, actualizado

2. CONTEXTO    prompt = story + CLAUDE.md + convenciones + gates que se van
               a correr + límites duros

3. AGENTE      claude --print --model opus  (sub-proceso, cwd = el worktree)
               edita, corre los gates él mismo, itera, y declara que terminó

4. GATES       el harness vuelve a correr los mismos comandos sobre el árbol
               final. Este resultado es el único que cuenta.
               falla -> paso 5.   pasa -> paso 6.

5. REINTENTO   se le devuelve al agente el stdout real del gate que falló.
               máximo 2 reintentos. luego aborta.

6. SALIDA      commit + push + gh pr create, con el trace enlazado
               git worktree remove
```

Los pasos 0, 1, 4, 5 y 6 son del harness. Solo el 3 es del agente.

## Las barandas

### Sandbox: un worktree desechable

Cada corrida crea su propio `git worktree`. El agente nunca ve el checkout
donde vos estás trabajando.

El motivo principal **no es seguridad, es saber qué cambió**. En un árbol
compartido no se puede distinguir "lo que el agente tocó" de "lo que ya
estaba sucio", y hay que inventar listas de archivos permitidos-sucios. En
un worktree limpio esa pregunta desaparece: `git status` *es* la lista de
cambios del agente. La protección contra un agente descarrilado sale gratis
de la misma decisión.

Aislar el proceso (contenedor, microVM) es otra cosa y no está hecho — ver
Pendientes.

### Verificación externa: el juez no es el acusado

El agente **debe** correr los gates durante su turno; se lo pide el prompt.
Eso hace que se autocorrija y que la mayoría de las corridas lleguen limpias
al final.

Pero el veredicto lo emite el harness, volviendo a correr los mismos
comandos sobre el árbol final. No es desconfianza ritual: son dos preguntas
distintas.

- El agente responde *"¿pasaban los tests cuando los corrí?"*
- El harness responde *"¿pasan los tests en el estado en que dejaste el
  repo?"*

Cuando las dos respuestas difieren, esa discrepancia es la señal más
valiosa que produce el sistema: o el agente reportó de más, o siguió
editando después de probar.

### Por qué el agente nunca se auto-califica

No es que mienta. Es que **hacer pasar un gate y hacer el trabajo son
objetivos distintos, y el gate es mucho más fácil**. Un agente al que se le
pide "que los tests pasen" tiene a mano:

- editar el test que molesta,
- agregarle `.skip`,
- sumar otro `--exclude` al script `test:unit` (que ya tiene cinco),
- o simplemente afirmar que pasaron.

Las tres primeras producen un gate verde y trabajo roto. Por eso el gate de
tests bloqueante viene **siempre acompañado** del gate de alcance del diff:
si tocás un `*.test.*` que la story no pidió, la corrida aborta. Hacer los
tests obligatorios sin vigilar el diff crea el incentivo de romperlos.

Y por eso la afirmación final del agente ("implementé X, los tests pasan")
se guarda en el trace como **dato**, nunca como condición para abrir el PR.

### Trace: qué pasó cuando nadie miraba

Toda corrida deja en disco el prompt exacto, la salida del agente, el
stdout y el exit code de cada gate, el diff y el veredicto. Sin eso, una
falla a las 2 de la mañana es irreconstruible: no se sabe si falló el
modelo, el prompt, el entorno o la story. Formato en
[HARNESS.md](HARNESS.md).

### El gate más barato: negarse a arrancar

La mayoría de los ~40 issues abiertos del repo no son ejecutables por un
agente — son epics (`M9.EP1 — Base de la aplicación y autenticación`). Un
agente al que le das eso no falla ruidosamente: te abre un PR confiado y
equivocado, y te cuesta más revisarlo que haberlo escrito.

Por eso el intake exige el label `agent-ready` como opt-in explícito, y
valida que la story tenga criterios de aceptación. Ver
[STORIES.md](STORIES.md).

## Qué NO hace este sistema

Decisiones tomadas a propósito, para que nadie las reconstruya como
pendientes:

- **No reimplementa el agente.** El CLI de `claude` ya es el bucle ReAct,
  las herramientas y el manejo de contexto. El harness lo invoca como
  sub-proceso; no define tools ni parsea tool calls ni cuenta turnos.
- **No indexa el repo.** Sin embeddings ni base vectorial. Con 14 módulos de
  estructura idéntica (`<mod>.routes/service/repository/schema/types.ts`),
  la convención de nombres ya es el índice y `grep` le gana.
- **No hace análisis estático propio.** No hay AST parsing: lo que dice si
  el código está bien es `tsc` y los tests.

## Pendientes

- **Aislamiento de proceso.** El worktree aísla archivos, no el proceso: el
  agente corre con tu usuario, tu red y tus credenciales. Contenedor o
  microVM es trabajo futuro.
- **Sin gate de lint.** No existe linter en el repo — ver
  [VERIFICATION.md](VERIFICATION.md).
- **Un solo rol.** Hoy solo hay agente implementador. Ver
  [AGENTS.md](AGENTS.md).
- **Relación con `scripts/agentic-harness.mjs`.** Ese harness previo sigue
  en el repo porque los workflows dependen de sus utilidades hermanas
  (`agentic-discord.mjs`, `issue-userstory.mjs`). Toma tareas como texto
  libre (`--task "..."`), no issues, y no tiene sandbox ni gate de alcance.
  Queda pendiente decidir si se deprecia.
