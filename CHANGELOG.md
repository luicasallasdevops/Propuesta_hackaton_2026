# Cambios

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
