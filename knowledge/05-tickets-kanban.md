# Tickets y tablero Kanban

## Tipos de ticket
- Pase a Producción: despliegue de un servicio. Usa la plantilla de Issue con checklist de evidencias.
- Solicitud de acceso: rol de GitHub o de herramienta.
- Solicitud de red: grupos de red y conectividad.
- Incidente: falla activa en producción.

## Columnas del tablero
Backlog, Preparación, Revisión QA, Revisión SecOps, Aprobado, Desplegado, Cerrado.

## Campos mínimos de un ticket de pase
Servicio, tipo de cambio, criticidad, tamaño, día de despliegue, plan de rollback, evidencias de QA, SAST, SCA y secretos, y descripción del cambio.

## Errores frecuentes que retrasan el pase
- Abrir el ticket sin evidencias de seguridad.
- Pedir grupos de red el mismo día del despliegue.
- No tener licencia GHAS asignada, por lo que CodeQL no corre.
- Programar viernes por la tarde sin rollback probado.
