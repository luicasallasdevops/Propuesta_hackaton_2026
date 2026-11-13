# Cambios

## 1.1.0-poc
- Pase a producción tipo OCD: formulario `[OCD]` con fecha y hora, y agente que valida riesgo y calendario (ventana martes a jueves, cupo, CAB, feriados, congelamientos, anticipación).
- El agente calcula las fechas de cada etapa, define los aprobadores (líder técnico, Seguridad, Change Management, Delegado CIO) y propone otra noche si la elegida no sirve.
- Pestaña **Pase OCD** en el portal: **simulador de creación del OCD estilo Jira** (el asistente valida grupos de red por servicio y aprobadores: líder técnico, Product Owner, Seguridad y Change Management; perfiles Valentina y Mateo), planificador con 5 casos, noches con cupo, tablero Kanban con OCD ficticios y simulador paso a paso.
- Guía interactiva de 10 pasos, chat con la guía del OCD, plantilla de solicitud y workflow de ejecución del OCD.
- Directorio ficticio (`ocd-directorio.json`): servicios, grupos de red, roles por servicio y perfiles.
- Documento 11 y 11 pruebas nuevas (19 en total).

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
