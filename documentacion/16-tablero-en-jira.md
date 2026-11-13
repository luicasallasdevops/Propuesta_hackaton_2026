# Mover el tablero del OCD de GitHub Projects a Jira

Estado: análisis. Hoy el agente mueve la tarjeta del OCD en GitHub Projects (`scripts/kanban.mjs`, GraphQL, token en el entorno `kanban`). La meta es que el tablero sea el de Jira: https://rochadavid0797.atlassian.net/jira/software/projects/KAN/boards/1

No pude abrir el tablero: pide iniciar sesión en Atlassian y no se ingresan credenciales por el usuario. Lo que sigue sale de lo que hace el agente hoy y de la API de Jira Cloud; hay que confirmar los puntos marcados con ❓.

## Qué cambia en el agente
| Hoy (GitHub Projects) | Con Jira |
|---|---|
| `scripts/kanban.mjs` mueve la tarjeta según la etiqueta `estado:*` | `scripts/jira.mjs` mueve la incidencia con `POST /rest/api/3/issue/{key}/transitions` |
| La tarjeta nace al abrir el Issue | El agente crea la incidencia (`POST /rest/api/3/issue`) o toma una existente y guarda su clave (KAN-n) en el Issue y en una etiqueta |
| El informe vive en el comentario del Issue | Se replica un resumen en Jira (`POST /rest/api/3/issue/{key}/comment`) |
| `sincronizar` alinea el tablero con las etiquetas | `sincronizar` compara el estado del Issue con el de Jira y corrige |

## Lo que necesitamos
1. **Acceso y permisos (lo más urgente).** Una cuenta con permisos en el proyecto KAN para ver, crear, transicionar y comentar incidencias. Hoy el sitio es de `rochadavid0797`: él debe dar el acceso o crear la credencial. Para producción, una cuenta de servicio y no una personal.
2. **Credenciales como secretos de GitHub** (nunca en el chat ni en el código): `JIRA_EMAIL` y `JIRA_API_TOKEN` (token de API de Atlassian) en un entorno protegido (por ejemplo `jira`, solo rama `main`). Variables no secretas: `JIRA_BASE_URL` y `JIRA_PROJECT_KEY=KAN`.
3. **Columnas y estados en el tablero KAN** ❓. Un tablero nuevo suele traer tres (Por hacer, En curso, Listo). El flujo OCD tiene 8 estados principales más 3 ramas. Hay que crear las columnas/estados (o definir cuáles agrupan varios) y permitir las transiciones entre ellos. Se guarda el mapa estado → estado de Jira en un archivo de datos (`knowledge/ocd-jira.json`).
4. **Tipo de incidencia y campos** ❓. Definir un tipo (por ejemplo «OCD») y dónde viven modalidad, servicio, criticidad, fecha del pase y riesgo: campos personalizados (según el tipo de proyecto, los administra el dueño del proyecto) o etiquetas.
5. **Historias.** Hoy la historia HU-3101 sale de datos de ejemplo. En Jira habría que acordar cómo se identifica (clave KAN-n, o un campo con el número HU) y desde dónde las consulta el portal. Un navegador no debe llamar a Jira con un token: se necesita un job programado que publique un JSON de historias junto al portal, o un pequeño servicio intermedio.
6. **Quién manda.** Decidir si el OCD nace en GitHub (Issue) y se refleja en Jira, o nace en Jira y dispara al agente. Para la prueba, lo más simple es lo primero. Lo segundo requiere una automatización de Jira que llame a GitHub con una credencial propia (GitHub App).
7. **Red y seguridad.** Los runners de GitHub Actions sí llegan a atlassian.net. Token con el mínimo de permisos, rotación periódica y registro de qué hizo el agente.
8. **Opcional para trabajar más rápido:** conectar el conector de Atlassian a Claude para que yo pueda leer el tablero, sus estados y campos y crear una incidencia de prueba.

## Preguntas abiertas
- ¿El proyecto KAN es gestionado por el equipo o por la empresa? Define cómo se crean estados y campos.
- ¿El tablero de GitHub se retira o se mantiene como espejo durante la transición?
- ¿Quién es el dueño del proyecto y puede crear columnas y campos?

## Plan sugerido
1. Dar acceso y crear el token (usuario).
2. Preparar columnas, tipo de incidencia y campos en KAN (dueño del proyecto).
3. `scripts/jira.mjs` con pruebas con respuestas simuladas, mapa estado → Jira y variable para elegir destino (`github` o `jira`).
4. Probar con un OCD real de punta a punta y retirar el tablero de GitHub.
