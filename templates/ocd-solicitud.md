# OCD: solicitud de pase a producción (campos del ticket en Jira)
Proyecto: OCD · Tipo de incidencia: Pase a Producción
Servicio: <nombre>
Matrícula: M-12345 (el agente verifica con ella tus grupos de red)
Tipo de cambio: Estándar | Normal | Emergencia
Criticidad: Alta | Media | Baja
Tamaño: Pequeño | Mediano | Grande
Fecha de ejecución: AAAA-MM-DD (martes a jueves)
Hora de inicio: HH:MM (entre 22:00 y 04:00)
Rollback: Sí, probado | Sí, sin probar | No

Evidencias: QA, SAST, SCA, secretos, runbook, monitoreo, red, licencias
Requisitos del OCD: ventana comunicada, plan de verificación posterior

Grupos de red: GR-APP, GR-DB, GR-DEPLOY (los que exija el servicio; verifica que los tienes)
Aprobadores: Líder técnico, Product Owner, Seguridad, Change Management (Delegado CIO si el riesgo es Crítico)
Descripción: qué cambia, qué servicios toca y cómo se verifica.
