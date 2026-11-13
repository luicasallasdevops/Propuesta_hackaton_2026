# Tablero del OCD en Jira (KAN)

Estado: implementado como espejo. GitHub sigue siendo la fuente del estado del OCD; Jira (https://rochadavid0797.atlassian.net/jira/software/projects/KAN/boards/1) lo refleja para el negocio. El tablero de GitHub Projects y `scripts/kanban.mjs` se **conservan** como evidencia.

## Cómo funciona
| Pieza | Qué hace |
|---|---|
| `scripts/jira.mjs` | Crea la incidencia del OCD (si no existe) y la mueve con `/transitions`. Se identifica por la etiqueta `gh-ocd-<n>`, así que es idempotente. |
| `knowledge/ocd-jira.json` | Mapa estado OCD → estado de Jira, proyecto, tipo y etiquetas. Editable sin tocar código. |
| Job `jira` (`ocd-flujo.yml`) | Tras cada cambio de estado en `main`. Si falla, el flujo de GitHub no se afecta. |
| Job `sincronizar-jira` | Diario y manual: alinea Jira con las etiquetas `estado:*` (cubre PR y tags) y repara incidencias que falten. |
| `jira-ocd.yml` | Comando `/jira crear` en un Issue `[OCD]` para crear o enlazar la incidencia bajo demanda. |
| Entorno `jira` | Secretos `JIRA_EMAIL` y `JIRA_API_TOKEN`; variable opcional `JIRA_BASE_URL` (por defecto el sitio de KAN). |

## Lo que existe en KAN (leído el 2026-11-13)
- Columnas: To Do, In Progress, In Review, Done. Estados: Tareas por hacer, En curso, En revisión, Finalizada. Las 4 transiciones están permitidas desde cualquier estado.
- Tipos: Epic, Tarea, Historia, Feature, Error, Subtask.
- Un tablero con 4 estados no representa los 11 del OCD, así que se agrupan y el estado exacto queda en la etiqueta `ocd-estado-<id>`:

| Estado Jira | Estados del OCD |
|---|---|
| Tareas por hacer | Inicio codificación |
| En revisión | Revisiones técnicas, Aprobación de seguridad |
| En curso | Congelamiento, Reversión de congelamiento, Gestión de pase, Ejecución, Reversión de pase, Ratificación, Reversión |
| Finalizada | Done |

## Pendiente
- Historias: el chat sigue usando datos de ejemplo. Falta un job que publique las historias de Jira como JSON junto al portal (el navegador no debe usar el token).
- Si el negocio quiere ver los 11 estados como columnas, el dueño del proyecto debe crearlos en el flujo de trabajo y se actualiza el mapa.
- Rotación del token y cuenta de servicio para producción (hoy es el token de una cuenta personal).
- Coordinar con `yegecali`: su rama `feature/integration-jira-confluence` trae otro `jira-ocd.yml` que usa los mismos secretos sin entorno; conviene unificar en esta versión.
