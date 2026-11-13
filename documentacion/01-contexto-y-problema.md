# Contexto y problema

**Desafío:** Anticiparse a los problemas antes de que ocurran.

## Qué pasa hoy
- Muchas incidencias se detectan cuando ya impactan a usuarios u operación.
- Hay información valiosa (incidentes históricos, métricas, cambios) que no se usa de forma preventiva.
- Para llegar a producción, los equipos deben crear tickets en tableros Kanban y pasar por aprobaciones de squads (QA, SecOps, Comité de Gestión de Cambios). La información de cómo hacerlo está dispersa.
- Tampoco es fácil saber qué roles pedir, qué grupos de red necesitan, qué licencias de GitHub deben estar activas ni qué controles de seguridad se exigen.

## Consecuencia
Entender el framework DevSecOps y preparar un pase puede tomar **semanas**. Eso genera retrabajo, pérdida de productividad, más riesgo operativo y peor experiencia para el cliente.

## Nuestra respuesta
Un asistente agéntico, 100% sobre GitHub, que:
1. **Responde** con el estándar exacto y cita la fuente.
2. **Entrega** plantillas de workflows seguras listas para copiar.
3. **Valida** el pase antes de que falle: calcula riesgo, bloquea lo que incumple, usa el historial de incidentes y recomienda acciones preventivas.
4. **Actúa** dentro del flujo de trabajo: comenta el Issue, etiqueta el riesgo y lista las aprobaciones necesarias.

## Criterios del hackathon y cómo los cubrimos
| Criterio | Evidencia en la POC |
|---|---|
| IA agéntica | El agente recupera política, razona con historial, decide y actúa en el Issue. Agentes de Copilot en el IDE con la misma base de conocimiento. |
| Prototipo y experiencia de usuario | Portal con chat, validador y plantillas con botón Copiar. Formulario de Issue guiado. |
| Impacto en ingeniería o negocio | Menos espera y retrabajo, menos pases que fallan. Métricas propuestas en el documento 05. |
| Innovación y diferenciación | Convierte incidentes pasados en prevención automática dentro del mismo flujo del equipo. |
| Factibilidad y escalabilidad | Solo GitHub nativo, sin infraestructura. Otras tribus cambian `knowledge/`. |

## Bonificaciones
- Productividad en el SDLC: respuestas y validación inmediatas.
- Menos riesgo en producción: bloqueos y acciones preventivas antes del pase.
- Reutilización: la base de conocimiento y la política se configuran por tribu.
- Implementable en 6 meses o menos: ver hoja de ruta.
- NPS de servicios CIO: menos espera y menos fallas.
