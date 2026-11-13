# Tickets y tablero Kanban

## Tipos de ticket
- Pase a Producción: despliegue de un servicio. Usa la plantilla de Issue con checklist de evidencias.
- Solicitud de acceso: rol de GitHub o de herramienta.
- Solicitud de red: grupos de red y conectividad.
- Incidente: falla activa en producción.

## Columnas del tablero
Backlog, Preparación, Revisión QA, Revisión SecOps, Aprobado, Desplegado, Cerrado.

## Campos mínimos de un ticket de pase
Servicio, tipo de cambio, criticidad, día de despliegue, plan de rollback, evidencias de QA, SAST, SCA y secretos, y descripción del cambio.

## Errores frecuentes que retrasan el pase
- Abrir el ticket sin evidencias de seguridad.
- Pedir grupos de red el mismo día del despliegue.
- No tener licencia GHAS asignada, por lo que CodeQL no corre.
- Programar viernes por la tarde sin rollback probado.

## Jira (tablero KAN)
El agente refleja cada OCD como una Tarea en el tablero KAN de Jira y la mueve según el estado del flujo: Inicio codificación en To Do, Revisiones técnicas y Aprobación de seguridad en In Review, el resto del recorrido en In Progress y Done en Done. Si no tienes historia de usuario, el asistente la arma y, al enviar el formulario «Historia de usuario», el agente la crea en Jira y te da su clave (KAN-12). Guía: documentacion/17-jira-paso-a-paso.md.

## Práctica guiada y OCD real: dónde se escribe cada cosa
- El chat del portal es una **práctica guiada**: sirve para aprender el flujo y validar tus datos, pero no crea nada en GitHub ni en Jira.
- El OCD **real** se crea con el formulario «Pase a Producción tipo OCD» en GitHub (el chat deja un botón que abre el formulario ya lleno). El agente lo valida y crea la tarea en Jira solo.
- Las **instrucciones** (congelamiento, despliegue y sus reversiones) van en los cuatro campos del formulario del Issue, o editando el Issue.
- Los **comandos** `/ocd mover <estado>`, `/ocd falla` y `/ocd devolver` se escriben como comentario en el Issue de GitHub. Jira se actualiza solo.
- En **Jira solo se mira** el avance: no se escriben instrucciones ni comandos allí.
