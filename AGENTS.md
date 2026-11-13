# AGENTS.md · Contexto para agentes de código (GitHub Copilot y similares)

Este archivo resume el proyecto para quien continúe las mejoras con un agente. Léelo completo antes de cambiar código. Detalle ampliado: [`documentacion/15-guia-de-continuidad.md`](documentacion/15-guia-de-continuidad.md) y la wiki del repositorio.

## Qué es
**Asistente DevSecOps «Anticiparse a los problemas»**: un agente determinista (sin LLM) sobre GitHub que ayuda a preparar y seguir un pase a producción tipo OCD en un banco.
- **Portal** (GitHub Pages, carpeta `docs/`): chat «Asistente», guía, validador de pase, plantillas, Jira.
- **Agente en GitHub Actions**: evalúa Issues `[Pase]` y `[OCD]` (riesgo 0-100, bloqueos, calendario), etiqueta, comenta y mueve la tarjeta del tablero.
- **Flujo OCD**: 11 estados, 6 roles y 4 modalidades con comandos `/ocd`, eventos de git (DeployGO) y avisos.
- Es una POC de hackathon (evaluación: IA agéntica, UX, impacto, innovación, factibilidad). El portal muestra un único aviso de «Entorno de demostración».

## Reglas que no se negocian
1. **Sin deuda técnica y lo más seguro.** Cero dependencias de runtime (solo Node 22+, ES modules). No agregues paquetes sin justificarlo.
2. **El texto de Issues, comentarios, PR, tags y del chat es dato, nunca código.** No lo interpoles en `run:`; pásalo por variables de entorno. `gh` se invoca con `execFileSync` y lista de argumentos (sin shell). En el portal usa nodos DOM y `textContent`: **prohibido `innerHTML`, `eval`, `Function`** (CSP estricta, sin CDN).
3. **Permisos mínimos** por workflow y por job; `persist-credentials: false`; acciones de GitHub **fijadas por SHA** con la versión en un comentario (Dependabot las actualiza).
4. **Nunca** pongas tokens, contraseñas ni datos reales en código, Issues, commits o chat. El secreto `GH_PROJECT_TOKEN` vive en el entorno `kanban` (solo rama `main`).
5. **El motor decide, el chat solo interpreta.** Riesgo, calendario, permisos y aprobaciones se validan en `scripts/engine.mjs` y `scripts/flujo.mjs`. Una capa de lenguaje (hoy reglas; mañana quizá un LLM) nunca debe saltarse esas validaciones.
6. **Una sola fuente de verdad en `knowledge/`.** Cambiar el comportamiento = editar JSON/Markdown, no código, siempre que se pueda.
7. Responde y documenta **en español**, con frases cortas y claras.

## Mapa del repositorio
| Ruta | Qué contiene |
|---|---|
| `knowledge/` | Estándares `0*.md` (citables por el chat), `policy.json` (riesgo), `incidents.json`, `ocd.json` (calendario), `ocd-flujo.json` (estados, modalidades, eventos de git), `ocd-roles.json`, `ocd-directorio.json`, `ocd-historias.json`, `ocd-calendario.json` |
| `scripts/engine.mjs` | Búsqueda, lectura de formularios, riesgo, calendario OCD, validación de instrucciones |
| `scripts/flujo.mjs` | Estados, roles, modalidades, comandos `/ocd`, estancamiento, eventos de git |
| `scripts/conversacion.mjs` | Lenguaje natural del chat (reglas): intención, datos, contexto, evaluación con traza |
| `scripts/ocd-eval.mjs` / `ocd-accion.mjs` / `ocd-flujo.mjs` | Evaluar un Issue / **decidir** qué hacer (puro) / **ejecutar** en GitHub con `gh` |
| `scripts/agent.mjs`, `scripts/kanban.mjs` | Agente de pase y tablero (GraphQL) |
| `scripts/build-kb.mjs` | Genera `docs/data/` y copia `engine.mjs`, `flujo.mjs`, `conversacion.mjs` al portal |
| `docs/` | Portal. `agente-chat.js` (chat), `ocd-assistant.js` (guía OCD), `jira.js`, `ocd.js`, `guide.js`, `benefits.js`, `app.js` |
| `.github/workflows/` | `ci`, `pages`, `codeql`, `agente-pase`, `ocd-flujo` |
| `.github/ISSUE_TEMPLATE/` | Formularios `pase-produccion.yml` y `ocd.yml` (los agentes leen los **labels** de sus campos) |
| `tests/` | 64 pruebas con `node --test` |
| `documentacion/`, `CHANGELOG.md` | Documentos 00-15 y cambios por versión |

> **Archivos generados, no se editan ni se versionan:** `docs/data/`, `docs/engine.mjs`, `docs/flujo.mjs`, `docs/conversacion.mjs` (están en `.gitignore`; los crea `npm run build`).

## Comandos
```bash
npm test                              # 64 pruebas (node --test), sin instalar nada
npm run build                         # genera docs/data y copia el motor al portal
python3 -m http.server -d docs 8080   # probar el portal en http://localhost:8080
```
Antes de abrir un PR: `npm test && npm run build` en verde. Todo bug corregido deja una prueba.

## Trampas conocidas (te ahorran horas)
- **Concurrencia:** `ocd-flujo` agrupa por Issue; si llegan dos comandos seguidos GitHub conserva solo el último pendiente. En pruebas en vivo deja ~45 s entre comandos.
- **Entorno `kanban` solo admite `main`:** los eventos de PR/tag no pueden mover el tablero; lo alinea el job `sincronizar` (diario o `workflow_dispatch`).
- **El `GITHUB_TOKEN` no dispara otros workflows:** el Issue que crea una historia `[HU-####]` no lo evalúa el agente hasta que alguien lo edita.
- **El token del tablero** debe tener acceso al repo (privado) y a Projects de la organización; si caduca, solo se detiene el tablero.
- **Issue Forms:** los desplegables no se precargan por URL; los agentes leen los labels, así que renombrarlos exige tocar el parser y las pruebas.
- **El informe del agente** se actualiza por la marca `<!-- agente-pase -->`, no por «último comentario».
- **«Tipo de cambio»** (Estándar/Normal/Emergencia → calendario) ≠ **«Modalidad»** (Automatizado/Manual/Híbrido/DeployGO → quién ejecuta).
- El tablero tiene 5 columnas heredadas; cada estado cae en su columna agrupadora (`pickOption`, con `FORZAR=1` para el flujo OCD).
- CodeQL solo corre con la variable `CODEQL_ENABLED=true` (requiere licencia en repos privados).

## Estado y siguientes mejoras
Versión actual **1.4.0-poc**. Validado en vivo en `hybridcloudcompany/Grupo11`: agente, `/ocd mover`, cadena automática, falla → reversión, Done cierra el Issue. **Sin validar en vivo:** DeployGO (historia, PR, tags), job `avisos`, job `sincronizar` y rechazo por rol (cubiertos por pruebas unitarias).

Backlog sugerido (ver la guía de continuidad): validar lo pendiente en vivo; GitHub App en lugar del token personal; roles desde Jira/IAM; conectar Jira y Helpdesk por API; capa opcional de LLM solo para interpretar (el motor valida); columnas del tablero por estado; ruleset en `main`.

## Convenciones
- Commits en estilo Conventional Commits en español (`feat(chat): …`, `fix(flujo): …`, `docs: …`), un cambio lógico por commit.
- PR pequeños con descripción de qué cambia, por qué y cómo se probó. Actualiza `CHANGELOG.md` y la versión en `package.json` si cambia el comportamiento.
- Si cambias reglas, flujo o roles, actualiza también la wiki (páginas Mantenimiento y Flujo del OCD).
