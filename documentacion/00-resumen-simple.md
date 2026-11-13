# Versión 0.1.0 (POC): qué hace y qué resuelve

Resumen sencillo, pensado para quien no es técnico. Todo el contenido de ejemplo (políticas, roles, incidentes) es **simulado**.

## En una frase
Un asistente que **revisa un cambio antes de que llegue a producción**, avisa qué puede salir mal y dice cómo corregirlo, para evitar fallos y esperas.

## El problema
Pasar un cambio a producción en un banco exige cumplir muchos requisitos: tickets, aprobaciones, roles, permisos de red, licencias y herramientas de seguridad.

- Los estándares están repartidos en varios documentos y la gente no sabe dónde mirar.
- Los equipos descubren lo que les falta **tarde**: cuando el pase ya está rechazado o, peor, cuando ya falló en producción.
- Cada rechazo cuesta días de idas y vueltas, y un fallo real cuesta dinero y confianza.
- Los incidentes pasados se repiten porque nadie los consulta al preparar el siguiente cambio.

## La solución
Un asistente con tres capacidades:

| Capacidad | Qué hace por ti | Ejemplo |
|---|---|---|
| 💬 **Responder** | Contesta dudas con el estándar oficial y cita de dónde sale. | "¿Qué rol necesito?" |
| 🛡️ **Anticipar** | Evalúa el cambio y da un riesgo de 0 a 100, los bloqueos y las acciones preventivas. | Un cambio de pagos en viernes sin plan de reversa sale **Bloqueado, Crítico 100/100**. |
| 📦 **Entregar plantillas** | Da procesos listos y seguros para copiar. | Revisión de seguridad, publicación protegida y actualizaciones automáticas. |

## Cómo funciona, paso a paso
1. El equipo abre un ticket de pase en GitHub (título que empieza con `[Pase]`) o usa el validador del portal.
2. **Un agente se activa solo** en GitHub Actions: lee los datos, aplica las reglas de riesgo y revisa el historial de incidentes.
3. El agente **comenta en el ticket** con el informe y pone etiquetas de color (riesgo y estado).
4. El equipo corrige lo que falta y edita el ticket. El agente reevalúa y **actualiza el mismo comentario**.
5. En paralelo, **la tarjeta del ticket se mueve sola en un tablero Kanban** (Bloqueado o Listo para aprobaciones) y las personas la avanzan hasta producción. Ver [tablero y token](06-tablero-kanban-y-github-app.md).
6. Cuando no quedan bloqueos, el ticket queda **Listo para aprobaciones** y solo se piden las aprobaciones que corresponden a ese nivel de riesgo.

## Qué revisa el agente
- **Bloqueos duros (no se puede pasar sin cumplirlos):** pruebas QA, análisis de código, análisis de dependencias, escaneo de secretos, aprobación del squad y plan de reversa.
- **Factores de riesgo:** criticidad del servicio, tamaño del cambio, día de la semana, controles faltantes e incidentes recientes del mismo servicio (últimos 90 días).
- **Niveles:** Bajo (hasta 29), Medio (hasta 54), Alto (hasta 74) y Crítico (más de 74).

## Qué se ve en la demo
- 🚨 **Caso riesgoso:** Bloqueado, Crítico 100/100, con los motivos y los incidentes pasados que lo respaldan.
- ✅ **Camino feliz:** Listo para aprobaciones, riesgo Medio (45/100) en el momento de la prueba, con aprobaciones de QA y Líder técnico. El número baja con el tiempo, porque los incidentes antiguos dejan de contar.
- 📋 **Tablero Kanban** en GitHub Projects, donde el agente coloca cada pase según su riesgo.
- 🧭 **Guía interactiva** en el portal, con iconos y botones que cargan los casos por ti.

## Por qué es "agéntico" y por qué es seguro
- El agente **actúa por sí mismo** ante un evento (un ticket nuevo o editado): lee, decide, comenta y etiqueta sin que nadie lo invoque.
- Es **determinista**: las mismas entradas dan siempre el mismo resultado, y cada decisión se puede explicar. No usa inteligencia artificial generativa dentro de Actions, así que no inventa respuestas ni envía datos a terceros.
- **Seguridad:** permisos mínimos por tarea, el texto del ticket se trata solo como dato (nunca como instrucciones), sin servicios externos, y análisis de código con CodeQL.
- **Sin costo extra:** corre con las funciones gratuitas de GitHub para repositorios públicos.

## Qué impacto busca
- ⏱️ **Productividad:** menos idas y vueltas; el equipo sabe lo que falta antes de pedir el pase.
- 🛡️ **Menos riesgo:** los problemas se detectan antes de producción y se reutiliza la experiencia de incidentes pasados.
- 🔁 **Reutilización:** otras tribus solo reemplazan la carpeta `knowledge/` con sus propios estándares.
- 📅 **Plazo realista:** la base ya funciona; conectar tableros e incidentes reales es un trabajo de semanas, dentro de los 6 meses.
- 😀 **Experiencia:** una sola puerta de entrada, con respuestas claras y una guía visual.

## Qué es POC y qué falta
- Datos simulados: no está conectado al tablero Kanban, a la gestión de incidentes ni al directorio real.
- Un resumen en lenguaje natural con IA es una mejora futura (requiere Copilot de la entidad o una clave de proveedor).
- Para producción: conectar fuentes reales por API, alimentar el historial de incidentes automáticamente y definir quién mantiene las políticas.

## Dónde probarlo
- Portal: https://luicasallasdevops.github.io/Propuesta_hackaton_2026/ (empieza por **Guía paso a paso**).
- Repositorio: https://github.com/luicasallasdevops/Propuesta_hackaton_2026
- Más detalle: [contexto](01-contexto-y-problema.md), [arquitectura](02-arquitectura.md), [guion de demo](03-guion-demo.md), [guía para equipos](04-guia-para-equipos.md), [seguridad y hoja de ruta](05-seguridad-decisiones-roadmap.md).
