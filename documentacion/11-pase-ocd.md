# Pase a producción tipo OCD (versión 1.1.0)

Todo el contenido es **simulado**: reglas, fechas, feriados, congelamientos y personas. Sirve para demostrar el flujo; las reglas reales las define Change Management.

## El problema
Un pase a producción tipo OCD es largo de preparar. Hay tres aprobadores (líder técnico, Seguridad y Change Management), una ventana nocturna con cupo limitado, un comité (Comité de Gestión de Cambios) que solo sesiona dos días por semana y fechas que se calculan hacia atrás. Quien lo crea por primera vez suele equivocarse de noche, llega tarde al Comité de Gestión de Cambios o descubre en la última hora que le faltaba una evidencia.

## Qué hace el agente ahora
1. **Valida el riesgo** del cambio (los mismos 9 controles y 6 bloqueos de siempre).
2. **Valida el calendario**: noche permitida, hora, cupo, feriados, congelamientos y anticipación.
3. **Calcula las fechas** de cada etapa hacia atrás desde la noche de ejecución.
4. **Define los aprobadores** según el tipo de cambio y el riesgo.
5. **Propone otra noche** cuando la elegida no sirve.
6. **Mueve la tarjeta** en el tablero Kanban: Bloqueado o Listo para aprobaciones.

## Reglas simuladas (archivo `knowledge/ocd.json`)
| Regla | Valor |
|---|---|
| Ventana | Martes a jueves, 22:00 a 04:00. La fecha es la noche en que empieza. |
| Cupo | Máximo 3 OCD por noche (Emergencia no cuenta). |
| Comité de Gestión de Cambios | Martes y jueves, 10:00. |
| Anticipación Normal | 5 a 7 días hábiles, según la sesión del Comité de Gestión de Cambios. |
| Anticipación Estándar | 2 días hábiles. Con riesgo Alto o Crítico se trata como Normal. |
| Emergencia | Sin restricción de calendario; aprobaciones a posteriori en máximo 24 h. |
| Congelamientos | 26-27 nov (evento comercial) y 18 dic al 4 ene (cierre de año). |
| Feriados | 8 dic, 25 dic y 1 ene. |

## Aprobadores
| Tipo | Aprobadores | Se suman |
|---|---|---|
| Estándar | Líder técnico, Change Management | Riesgo Alto: Seguridad. Crítico: Delegado CIO. |
| Normal | Líder técnico, Product Owner, Seguridad, Change Management | Riesgo Crítico: Delegado CIO. |
| Emergencia | Líder técnico; Product Owner informado; Seguridad y Change Management a posteriori | En congelamiento: Delegado CIO. |

## El calendario que calcula el agente
Ejemplo para un OCD Normal con ejecución el jueves 19 de noviembre:

| Fecha | Etapa | Responsable |
|---|---|---|
| Jue 12/11 | Crear el OCD con sus evidencias y pre-validación del agente | Solicitante, agente |
| Vie 13/11 | Revisión del líder técnico | Líder técnico |
| Lun 16/11 | Revisión de Seguridad | Seguridad |
| Mar 17/11 | Aprobación en el Comité de Gestión de Cambios | Change Management |
| Mié 18/11 | Confirmar ventana y avisar a las áreas | Solicitante |
| Jue 19/11 22:00 | Ejecutar el pase | Solicitante y operaciones |
| Jue 19/11 | Verificar 30 minutos | Solicitante |
| Vie 20/11 | Cerrar el OCD con la evidencia | Solicitante |

## Datos ficticios para la demo
Fecha de la simulación: **lunes 16 de noviembre de 2026** (campo "Hoy" del planificador). Los OCD de ejemplo viven en `knowledge/ocd-calendario.json`.

| OCD | Servicio | Tipo | Noche | Columna | Qué enseña |
|---|---|---|---|---|---|
| OCD-2006 | core-cuentas | Normal | 1 dic | Solicitado | Recién creado, aún sin evaluar |
| OCD-2005 | pagos-api | Normal | Vie 20 nov | Bloqueado | Viernes, rollback No, sin SAST ni SCA |
| OCD-2003 | core-cuentas | Normal | Jue 19 nov | Listo para aprobaciones | Líder aprobó; falta Seguridad y Comité de Gestión de Cambios |
| OCD-2002 | pagos-api | Normal | Mié 18 nov | Aprobado | Las tres aprobaciones listas |
| OCD-2004 | canal-web | Estándar | Mié 18 nov | Aprobado | Preaprobado |
| OCD-2008 | tarjetas-api | Estándar | Mié 18 nov | Aprobado | Con los dos anteriores llena la noche (3 de 3) |
| OCD-2001 | canal-web | Normal | Mar 10 nov | En producción | Ya ejecutado |
| OCD-2007 | notificaciones | Emergencia | Lun 16 nov | En producción | Aprobación a posteriori pendiente |

## Caso de negocio: creación de OCD con el agente
**Escenario 1: el usuario pregunta cómo crear un OCD**
1. El agente responde con la guía y pregunta si quiere que valide sus grupos de red de DevSecOps.
2. Pide la **matrícula** (M-12345) en una caja de texto, pregunta el rol (Líder técnico o Team Member) y revisa los grupos de red del rol.
3. Si faltan, pregunta: "¿Quieres que yo cree la solicitud en Helpdesk?". Crea el ticket simulado `HD-n` (cola Accesos y redes, aprobador líder técnico, 3 días hábiles) y puede simular la aprobación para continuar la demo.
4. Si están completos, ofrece seguir con la creación del OCD.

**Escenario 2: el usuario pide crear un OCD** ("quiero crear un OCD")
1. Pide la **historia** (HU-1234). La valida: existe y es del servicio del cambio. Si el usuario no la sabe, el agente la crea con tres preguntas (quién se beneficia, qué quiere, para qué) y le asigna una HU nueva con criterios de aceptación.
2. Pide **todos los datos del OCD menos las instrucciones**: tipo, criticidad, rollback, evidencias y descripción, y asocia la historia (buscada en Jira y confirmada por el usuario). La fecha y la hora se piden después, en Gestión de pase (sugiere la primera noche válida).
3. Crea el OCD simulado con la pre-validación (estado, riesgo, bloqueos, aprobadores).
4. **Guía interactiva:** recorre las etapas del calendario con botón "Hecho, siguiente".
5. En la **revisión del líder técnico** pide las **instrucciones de despliegue** y las valida: mínimo 80 caracteres, 3 pasos numerados, rollback, verificación posterior, sin secretos ni comandos peligrosos (avisos: servicio, ambiente, respaldo si la criticidad es Alta). Ofrece una plantilla y repite hasta que pasen.
6. Al final abre el simulador de Jira con la historia y las instrucciones cargadas.

**Agente real (GitHub):** el formulario del OCD pide **Matrícula** y **Historia asociada** (obligatorias) e **Instrucciones de despliegue** (opcionales). El informe añade "Solicitante y grupos de red" (DevSecOps y del servicio), "Historia asociada" e "Instrucciones de despliegue", y bloquea el OCD si falta la matrícula, un grupo de red, la historia o si las instrucciones escritas no pasan la revisión.

Matrículas ficticias de la demo (`knowledge/ocd-directorio.json`):

| Matrícula | Persona | Grupos DevSecOps | Grupos del servicio |
|---|---|---|---|
| M-10458 | Valentina Ríos, nueva | Solo INCT_DEVELOPER_INCT_PROD | (sin grupos adicionales por servicio) |
| M-10212 | Mateo Díaz, con experiencia | Los 4 grupos (ADMIN y DEVELOPER) | (sin grupos adicionales por servicio) |
| M-10777 | Camilo Ortiz | Ninguno | Ninguno |

Historias ficticias (`knowledge/ocd-historias.json`): HU-3101 y HU-3102 (pagos-api), HU-3110 y HU-3111 (core-cuentas), HU-3120 (canal-web), HU-3130 (tarjetas-api), HU-3140 (notificaciones).

## El OCD se crea en Jira (simulado)
El usuario real crea el OCD en **Jira** (proyecto OCD, tipo de incidencia Pase a Producción). En la POC no hay Jira: el portal lo **simula** con una pantalla estilo Jira y el motor real corre en GitHub (Issue `[OCD]` + Actions + tablero). En producción, el mismo agente leería el ticket de Jira por su API y escribiría el comentario y el estado allí.

El asistente de la pantalla enseña al usuario nuevo en 3 chequeos antes de crear el ticket:
1. **Grupos de red:** según el rol, Líder técnico (INCT_ADMIN_INCT_PROD y VSDP-ADMIN) o Team Member (INCT_DEVELOPER_INCT_PROD y VSDP-DEVELOPER). Compara contra los que tiene el usuario y explica cómo pedir los que faltan (ticket de Solicitud de red, 3 días hábiles).
2. **Aprobadores:** muestra quién es el líder técnico, el Product Owner, Seguridad y Change Management **de ese servicio** y avisa si se eligió a la persona equivocada.
3. **Calendario y riesgo:** las mismas reglas del agente (noche, cupo, congelamientos, anticipación).

Al crear el ticket, el agente comenta, calcula el calendario y mueve el estado. Se puede simular cada aprobación y la ejecución en la ventana.

Datos ficticios en `knowledge/ocd-directorio.json`: 5 servicios, 4 grupos de red, 10 personas y tres perfiles con matrícula. Valentina (nueva en pagos-api) verá qué le falta; Mateo (con experiencia) verá el camino sin tropiezos; Camilo no tiene ningún grupo.

## Dónde verlo en el portal
Pestaña **📅 Pase OCD**:
- **Simulador de Jira** (arriba): elige a Valentina, pulsa Crear y mira el bloqueo; pulsa Autocompletar, cambia a Mateo, crea de nuevo, simula las 4 aprobaciones y ejecuta.
- **Recorrido en 6 pasos** y **planificador rápido** con 5 casos precargados (OCD listo, noche llena, viernes sin rollback, congelamiento, emergencia).
- **Noches de la ventana** con el cupo de cada una.
- **Tablero Kanban** con los OCD de ejemplo; al tocar una tarjeta se ven sus aprobaciones.
- **Simulador** que mueve una tarjeta por el tablero, paso a paso, en tres escenarios.

## Cómo probar el agente real en GitHub
Abre el formulario **Pase a Producción tipo OCD** (equivale al ticket de Jira en la POC) (el portal lo enlaza con servicio, fecha y hora precargados). El título empieza con `[OCD]`. Los desplegables no se precargan por URL: elígelos a mano.

| Caso | Matrícula | Servicio | Tipo | Crit. | Fecha | Hora | Rollback | Casillas | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| Listo | M-10212 | core-cuentas | Normal | Media | 2026-11-24 | 22:00 | Sí, probado | las 9 + las 2 de requisitos | Listo para aprobaciones, Bajo |
| Faltan grupos de red | M-10458 | pagos-api | Normal | Media | 2026-11-24 | 22:00 | Sí, probado | las 9 + las 2 | Bloqueado: falta VSDP-DEVELOPER |
| Bloqueado | M-10212 | pagos-api | Normal | Alta | 2026-11-20 | 22:00 | No | ninguna | Bloqueado (sin rollback) |
| Noche llena | M-10212 | notificaciones | Estándar | Baja | 2026-11-18 | 23:30 | Sí, probado | las 9 + las 2 | Bloqueado: ventana llena y propone el jueves 19 |

Los Issues #3 y #4 se crearon antes de los campos Matrícula e Historia: si se editan, el agente los bloqueará hasta que se agreguen (por ejemplo `M-10212` y `HU-3101`).

Si ya pasó el 16 de noviembre, usa un martes a jueves con al menos 7 días hábiles de anticipación: el agente compara contra la fecha real del día.

## Seguridad de la función
- El texto del Issue sigue siendo **solo dato**: la fecha y la hora se validan con formato estricto y los informes neutralizan menciones y etiquetas.
- El job `tablero` y sus permisos no cambian: mismo entorno protegido y mismo filtro de personas del equipo.
- El workflow de ejecución `templates/workflows/ocd-ejecucion.yml` usa acciones fijadas por SHA, permisos mínimos y el ambiente `production` con aprobadores.

## Límites de la POC
- La ocupación de las noches sale de `ocd-calendario.json`. Los Issues nuevos no la actualizan. En producción se alimenta del calendario de Change Management por API.
- El directorio de personas y de grupos de red es ficticio; en producción sale del directorio corporativo y de la gestión de accesos.
- Las aprobaciones de las personas se simulan en el portal; en GitHub las gestiona el ambiente protegido y el tablero.
- Feriados y congelamientos son ficticios y no cubren zonas horarias.

## Para escalarlo
Cada tribu ajusta su `ocd.json` (ventana, cupo, Comité de Gestión de Cambios, feriados) sin tocar el código. El calendario real y los aprobadores nominales se conectan a la herramienta de gestión de cambios y al directorio corporativo.
