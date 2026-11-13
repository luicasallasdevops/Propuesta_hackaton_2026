# Jira paso a paso: configurar, probar y usar

Para quien quiere que el agente refleje sus OCD y cree historias en el tablero KAN de Jira. Tiempo estimado: 15 minutos.

## Cómo se ve funcionando
1. Alguien crea un OCD (chat o Issue). El agente crea una **Tarea** en KAN con el título del OCD.
2. Cada vez que el OCD cambia de estado, la Tarea se mueve de columna. GitHub manda; Jira es el espejo.
3. Si la persona no tiene historia, el chat la arma y abre un formulario; el agente crea la **Historia** en Jira y responde con su clave (KAN-12).

| Estado del OCD | Columna en Jira |
|---|---|
| Inicio codificación | To Do (Tareas por hacer) |
| Revisiones técnicas, Aprobación de seguridad | In Review (En revisión) |
| Congelamiento, Gestión de pase, Ejecución, Ratificación y reversiones | In Progress (En curso) |
| Done | Done (Finalizada) |

El estado exacto queda en la etiqueta `ocd-estado-<id>` de la Tarea.

## Qué necesitas (una sola vez)
| Qué | Dónde | Notas |
|---|---|---|
| Cuenta de Atlassian con permiso de **crear incidencias** en KAN | Jira → Espacio KAN → Configuración del espacio → Acceso | Debe ser **Miembro** (o rol con «Crear incidencias»). Sin esto la API responde «el proyecto no existe o no tienes permiso». |
| API token de esa cuenta | https://id.atlassian.com/manage-profile/security/api-tokens | Crea un token sin alcance limitado y caduca en 1 año como máximo. |
| Secreto `JIRA_EMAIL` | GitHub → Settings → Environments → `jira` | El correo **de la misma cuenta** que creó el token. |
| Secreto `JIRA_API_TOKEN` | Igual | El token. Nunca en chats ni en el código. |
| Variable `JIRA_BASE_URL` (opcional) | Igual | Por defecto `https://rochadavid0797.atlassian.net`. |

El entorno `jira` debe estar limitado a la rama `main`.

## Cómo probar que quedó bien (5 minutos)
1. Actions → **ocd-flujo** → Run workflow. El job `sincronizar-jira` debe salir en verde y en KAN aparece una Tarea por cada OCD.
2. Crea un Issue con el formulario **Historia de usuario**. En segundos el agente responde con la clave (KAN-n) y la Historia aparece en KAN.
3. Comenta `/ocd mover revisiones` en un OCD: la Tarea pasa a In Review.

## Comandos
| Dónde | Qué hacer | Resultado |
|---|---|---|
| Issue `[OCD]` | `/jira crear` | Crea o enlaza la Tarea de ese OCD |
| Formulario «Historia de usuario» | Enviarlo | Crea la Historia y responde con la clave |
| Actions → ocd-flujo | Run workflow | Alinea todo Jira con GitHub |

## Si algo falla
| Mensaje | Causa | Solución |
|---|---|---|
| `HTTP 400 … el proyecto no existe o no tienes permiso` | La cuenta del token no es miembro de KAN | Agrégala como Miembro del espacio KAN |
| `HTTP 401` | Correo y token no son de la misma cuenta, o el token venció | Genera otro token y actualiza ambos secretos |
| `no hay transición hacia "…"` | El flujo de trabajo de KAN no permite el movimiento | Revisa los estados del espacio KAN |
| «JIRA_API_TOKEN no están configurados» | Falta algún secreto en el entorno `jira` | Créalos en Settings → Environments → jira |
| Nada pasa tras comentar `/jira crear` | El workflow `jira-ocd` solo corre desde `main` | Verifica que el cambio esté en `main` |

## Qué se conserva
El tablero de GitHub Projects y `scripts/kanban.mjs` siguen en el repositorio como evidencia y respaldo. Los dos tableros pueden convivir.

## Pendiente
Buscar historias existentes desde el chat (requiere publicar las historias de Jira como JSON), crear los 11 estados como columnas si el negocio lo pide y usar una cuenta de servicio en producción.

## Práctica guiada y OCD real: dónde se escribe cada cosa
- El chat del portal es una **práctica guiada**: sirve para aprender el flujo y validar tus datos, pero no crea nada en GitHub ni en Jira.
- El OCD **real** se crea con el formulario «Pase a Producción tipo OCD» en GitHub (el chat deja un botón que abre el formulario ya lleno). El agente lo valida y crea la tarea en Jira solo.
- Las **instrucciones** (congelamiento, despliegue y sus reversiones) van en los cuatro campos del formulario del Issue, o editando el Issue.
- Los **comandos** `/ocd mover <estado>`, `/ocd falla` y `/ocd devolver` se escriben como comentario en el Issue de GitHub. Jira se actualiza solo.
- En **Jira solo se mira** el avance: no se escriben instrucciones ni comandos allí.

## Si el formulario del OCD sale en blanco
GitHub ignora en silencio las plantillas con YAML inválido y muestra un Issue vacío. Revisa que `/issues/new/choose` liste las tres plantillas (Pase a Producción, OCD e Historia de usuario). Los valores con «: » dentro deben llevar comillas; `npm test` lo verifica.
