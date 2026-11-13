# Cambios

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
