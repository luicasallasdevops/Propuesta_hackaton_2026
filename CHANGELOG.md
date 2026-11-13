# Cambios

## 1.6.2-poc
Progreso por fases y guía de adopción de Jira.
- **Panel de progreso en dos fases:** Requisitos y OCD. Al completar los requisitos la fase se marca en verde y se colapsa (se puede reabrir) para dar foco al OCD. El panel es sólido y las respuestas del chat se muestran debajo, sin quedar tapadas.
- Documento 17 «Jira paso a paso» (configurar, probar, errores comunes) y wiki «Integración con Jira».

## 1.6.1-poc
El agente crea historias de usuario reales en Jira.
- Formulario «Historia de usuario» y workflow `historia-jira`: crea la historia (tipo Historia) en el tablero KAN y responde en el Issue con su clave.
- En el chat, «No tengo historia, ayúdame a crearla» arma la historia y abre el formulario ya lleno; el usuario escribe la clave (KAN-12) y el OCD queda asociado. Las claves KAN-n se aceptan como historia.
- Los errores de Jira ahora muestran el detalle (campos inválidos o permisos) para diagnosticar.

## 1.6.0-poc
Integración con Jira: el OCD se refleja en el tablero KAN.
- `scripts/jira.mjs` y `knowledge/ocd-jira.json`: crea la incidencia del OCD y la mueve según el estado del flujo (4 estados de Jira, estado exacto en una etiqueta).
- Jobs `jira` y `sincronizar-jira` en `ocd-flujo` y workflow `jira-ocd` con el comando `/jira crear`. Credenciales solo en el entorno `jira`.
- GitHub Projects y `kanban.mjs` se conservan como evidencia. Documento 16 con lo leído del tablero.

## 1.5.1-poc
Portal aún más minimalista y con progreso visible durante la guía del OCD.
- El menú de secciones pasa al pie y se retira la etiqueta de «Entorno de demostración». La caja de chat es más grande.
- **Panel de progreso** durante la creación del OCD: requisitos (matrícula, grupos, historia, modalidad, datos), porcentaje, clave del OCD y estado actual. Las preguntas comunes no lo muestran y se retoma al volver al OCD.
- Transición suave al enviar el primer mensaje: la portada se desvanece y el campo se desliza hacia abajo.
- Documento 16: análisis para mover el tablero del OCD de GitHub Projects a Jira.

## 1.5.0-poc
Portal más limpio, con el chat como protagonista, y una guía del OCD que acompaña el flujo real.
- **Diseño tipo ChatGPT:** buscador grande al centro, atajos como tarjetas y, al conversar, el chat ocupa la página con el campo fijo abajo. El aviso de demostración pasa a una etiqueta discreta.
- **Flujo gráfico** al pie: prerrequisitos (matrícula, grupos de red, historia en Jira, modalidad, datos) → 8 estados del OCD → ramas si algo falla. Marca el paso actual mientras el agente guía y cada nodo explica qué hacer.
- **Conversación más natural:** cada respuesta aparece tras una breve espera con el indicador de «escribiendo»; el detalle va colapsado con enlace a la documentación de donde sale.
- **Matrícula e historia en cajas de texto.** La historia se busca en Jira y muestra título, tablero y quién la creó para que el usuario la confirme.
- **Grupos de red reales:** INCT_ADMIN_INCT_PROD y VSDP-ADMIN para líderes técnicos (LT); INCT_DEVELOPER_INCT_PROD y VSDP-DEVELOPER para Team Members (TM). El agente pregunta el rol. El formulario `[OCD]` pide «Rol del solicitante».
- **Modalidad con ejemplos** de OCD y enlace a la documentación; **criticidad** con enlace y ventana emergente; «CAB» pasa a «Comité de Gestión de Cambios»; se retira el tamaño del cambio.
- **La fecha y la hora del pase se piden en Gestión de pase**, no al inicio; ahí se valida contra el calendario y se muestran aprobadores y plan.
- 65 pruebas.

## 1.4.0-poc
El asistente pasa a ser la puerta de entrada: entiende frases libres, conserva el contexto y muestra qué hizo.
- **Chat protagonista:** primera pestaña («Asistente»), saludo cordial según la hora, menú de opciones (crear OCD paso a paso, validar mi pase, cómo funciona el OCD, qué me toca según mi rol, roles/red/licencias, plantillas), atajos permanentes y sugerencias de siguiente paso tras cada respuesta.
- **Lenguaje natural sin LLM:** `scripts/conversacion.mjs` entiende servicio, día («este viernes», «mañana», «24 de noviembre»), rollback, criticidad, tamaño, tipo y controles faltantes. Ej.: «Necesito desplegar pagos-api este viernes y todavía no tengo rollback» devuelve Bloqueado, los motivos, la próxima noche válida y un botón para preparar el OCD.
- **Contexto:** pregunta solo lo que falta, arma la guía del OCD con lo ya dicho, acepta cambios a mitad («mejor el martes») y, si el usuario hace una pregunta intermedia, la responde y ofrece retomar el OCD donde iba.
- **Traza visible:** cada evaluación muestra qué consultó el agente, qué detectó, qué propone, qué hizo y la evidencia reproducible, además del enlace para crear el OCD real en GitHub.
- **Aviso único de «Entorno de demostración»** que explica qué es real (Issues, Actions, etiquetas, tablero) y qué es demostrativo (Jira, Helpdesk, directorio); se retiraron los avisos repetidos de «simulado» del portal, el chat, los informes del agente y los datos.
- 8 pruebas nuevas (64 en total). Un modelo de lenguaje opcional queda como siguiente fase: solo interpretaría la intención y el motor seguiría validando riesgo, permisos y aprobaciones.

## 1.3.0-poc
Flujo OCD real en tres fases, todo guiado por un solo archivo de datos (`knowledge/ocd-flujo.json`).
- **Fase 1, flujo y agente por estado y rol:** 11 estados (Inicio codificación, Revisiones técnicas, Aprobación de seguridad, Congelamiento, Gestión de pase, Ejecución, Ratificación, Done y las ramas de reversión), 6 roles y 4 modalidades (Automatizado, Manual, Híbrido, DeployGO). Cuatro conjuntos de instrucciones (congelamiento, despliegue, reversión de congelamiento, reversión de despliegue) validados según la modalidad (`[AUTO]` y `[MANUAL]`). El chat explica el flujo y responde «¿qué me toca?» según el rol; la guía interactiva recorre los estados reales, con las ramas de falla. El formulario `[OCD]` pide la modalidad y los tres conjuntos nuevos; el informe del agente incluye el estado, los requisitos y cómo moverlo.
- **Fase 2, estados reales en GitHub:** etiquetas `estado:*` y `modalidad:*`, comandos de comentario `/ocd estado|mover|falla|devolver` que validan el rol del actor (`knowledge/ocd-roles.json`) y los requisitos de salida, estados automáticos que corren solos según la modalidad, cierre del Issue en Done y tarjeta del tablero siguiendo el estado (columna con el nombre del estado o, si no existe, su columna agrupadora). El simulador de Jira trae el panel «Flujo del OCD» con el selector de rol.
- **Fase 3, DeployGO y avisos:** los eventos de git mueven el estado (PR abierto, PR aprobado por rol, tags `ocd-N-cert|prod|ratificado|revertir`), una historia `[HU-####]` crea su OCD DeployGO y un aviso diario por días hábiles de estancamiento menciona al rol que debe actuar. Un job de sincronización alinea el tablero con las etiquetas.
- El informe del agente se actualiza por marca (`<!-- agente-pase -->`) y no por ser el último comentario. El motor expone `esc`, `SECRETOS` y `PELIGROSO` para el módulo del flujo.
- 33 pruebas nuevas (56 en total). Supuestos del flujo documentados en el documento 13.

## 1.2.2-poc
- Corrige la consulta del tablero (llave faltante) y añade una prueba que la valida. Permisos `pages: read` y `actions: read` para repositorios privados.

## 1.2.1-poc
- Migración al repositorio `hybridcloudcompany/Grupo11`: el tablero funciona con dueños persona u organización, enlaces y valores de respaldo actualizados y guía de configuración (documento 12).

## 1.2.0-poc
- **Escenario 1 del OCD:** cuando el usuario pregunta cómo crear un OCD, el agente ofrece validar con su matrícula los grupos de red de DevSecOps (GR-DSO-GITHUB, GR-DSO-SCAN, GR-DSO-RELEASE). Si faltan, ofrece crear la solicitud en Helpdesk (ticket simulado HD-n con aprobación del líder).
- **Escenario 2 del OCD:** el usuario pide crear un OCD, el agente pide su historia (HU-1234; si no la sabe, la crea con él), pide todos los datos del OCD menos las instrucciones, asocia la historia, guía paso a paso la gestión con el calendario y valida las instrucciones de despliegue al llegar a la revisión técnica (con plantilla de ayuda).
- El simulador de Jira muestra los grupos DevSecOps, la historia asociada y las instrucciones con validación en vivo.
- El agente real y el formulario `[OCD]` validan historia (obligatoria) e instrucciones (opcionales) y los grupos de DevSecOps.
- Datos ficticios nuevos: historias (`ocd-historias.json`) y grupos DevSecOps. 2 pruebas nuevas (23 en total).

## 1.1.0-poc
- Pase a producción tipo OCD: formulario `[OCD]` con fecha y hora, y agente que valida riesgo y calendario (ventana martes a jueves, cupo, CAB, feriados, congelamientos, anticipación).
- El agente calcula las fechas de cada etapa, define los aprobadores (líder técnico, Seguridad, Change Management, Delegado CIO) y propone otra noche si la elegida no sirve.
- Pestaña **Pase OCD** en el portal: **simulador de creación del OCD estilo Jira** (el asistente valida grupos de red por servicio y aprobadores: líder técnico, Product Owner, Seguridad y Change Management; perfiles Valentina y Mateo), planificador con 5 casos, noches con cupo, tablero Kanban con OCD ficticios y simulador paso a paso.
- El agente del chat ofrece ayudar a crear el OCD: pide la matrícula, verifica los grupos de red del servicio, muestra los aprobadores, revisa el calendario y abre el simulador de Jira con los datos cargados.
- El formulario del OCD pide la **matrícula**; el agente real bloquea el OCD si la matrícula falta, no existe o no tiene los grupos de red del servicio.
- Guía interactiva de 10 pasos, chat con la guía del OCD, plantilla de solicitud y workflow de ejecución del OCD.
- Directorio ficticio (`ocd-directorio.json`): servicios, grupos de red, roles por servicio y perfiles.
- Documento 11 y 13 pruebas nuevas (21 en total).

## 1.0.0-poc
- Acciones de GitHub fijadas por SHA (Dependabot las mantiene).
- Protecciones activadas: alertas de Dependabot, escaneo de secretos con bloqueo de pushes, reporte privado de vulnerabilidades y aprobación de workflows de externos.
- Tablero público con descripción y README; probado con un ticket listo y uno bloqueado.
- Análisis de funcionalidad y seguridad (documento 08) y resumen de la versión (documento 09).
- Guion de demo de 6 minutos y SECURITY.md actualizados.

## 0.2.0-poc
- Tablero Kanban en GitHub Projects; el agente mueve la tarjeta a *Bloqueado* o *Listo para aprobaciones*.
- No mueve tarjetas que una persona ya avanzó; solo procesa tickets del equipo.
- Token en el entorno protegido `kanban` (solo `main`), nombre `GH_PROJECT_TOKEN`.
- Guía interactiva visual de 9 pasos, con iconos, progreso y botón de regreso.
- Pestaña Beneficios: 6 pilares, gráfico de riesgo en vivo con el motor real, antes/después, cifras de la POC y criterios del reto.
- Documentación: resumen simple 0.2.0 y recomendación de GitHub App para producción.

## 0.1.0-poc
- Asistente con chat, validador de pases, plantillas seguras y agente de pre-validación en GitHub Actions.
