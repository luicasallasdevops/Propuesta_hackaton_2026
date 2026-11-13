# Pase a producción

> Contenido SIMULADO para la POC. Reemplazar por los lineamientos oficiales del equipo SecOps.

## Flujo general del pase a producción
1. Crear el ticket "Pase a Producción" en el tablero Kanban (usar la plantilla de Issue del portal).
2. Adjuntar evidencias: pruebas QA, resultado SAST, resultado SCA, escaneo de secretos y plan de rollback.
3. Obtener aprobaciones del squad: QA siempre; líder técnico desde riesgo medio; SecOps y CAB desde riesgo alto.
4. Agendar ventana de despliegue. Ventana estándar: martes a jueves, 22:00 a 04:00. Evitar viernes, fines de semana y vísperas de festivo.
5. Ejecutar el despliegue con el workflow de release (ambiente protegido `production` con aprobadores requeridos).
6. Verificación posterior: revisar métricas y alertas durante 30 minutos y cerrar el ticket con evidencia.

## Tipos de cambio y tiempos de atención
- Estándar: cambio repetible y de bajo riesgo. Atención en 1 día hábil.
- Normal: cambio planificado. Atención en 3 días hábiles; requiere aprobación de líder técnico.
- Emergencia: corrige un incidente activo. Se ejecuta de inmediato y se aprueba a posteriori en máximo 24 horas.

## Criterios de bloqueo (no negociables)
- Hallazgos críticos o altos abiertos en SAST o SCA.
- Secretos detectados en el repositorio o en el historial.
- Sin plan de rollback definido.
- Sin aprobación del squad de QA.
