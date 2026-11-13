# Seguridad, decisiones y hoja de ruta

## Decisiones de diseño
| Decisión | Motivo |
|---|---|
| Solo GitHub (Pages, Actions, Issues, Copilot) | Sin infraestructura nueva, rápido de adoptar y gratis en la POC |
| Cero dependencias de runtime | Sin cadena de suministro que mantener ni vulnerabilidades heredadas |
| Reglas deterministas para decidir en Actions, Copilot como agente conversacional en el IDE | Auditable y reproducible en un banco |
| Conocimiento como Markdown versionado | Cambios por pull request, con historial y revisión |
| Motor único para portal y agente | Una sola lógica que probar |

## Controles de seguridad aplicados
- Permisos mínimos por workflow y por job. `persist-credentials: false`.
- El texto del Issue es solo dato: no se interpola en comandos. Menciones y HTML se neutralizan.
- Portal con CSP estricta, sin scripts ni recursos externos y sin `innerHTML` con datos de usuario.
- Acciones en versiones recientes, con Dependabot semanal.
- CodeQL sobre el propio repositorio.
- Sin llamadas a servicios externos de IA en Actions: no hay claves ni datos que salgan del repositorio.

## Límites de la POC (honestidad ante el jurado)
- Datos simulados. No hay conexión a un tablero Kanban real ni a gestión de incidentes.
- El puntaje de riesgo es una heurística, no un modelo entrenado.
- GitHub Models se retiró el 30-jul-2026. El agente en Actions no usa un LLM; es razonamiento con reglas, política e historial.
- Copilot cloud agent y code review requieren plan de pago. La entidad ya los tiene.
- Las acciones están por versión mayor. En producción conviene fijarlas por SHA.

## Hoja de ruta (6 meses o menos)
| Mes | Hito |
|---|---|
| 1 | Cargar estándares reales de SecOps. Piloto con un squad |
| 2 | Conectar el tablero Kanban y la gestión de incidentes por API |
| 3 | Alimentar el historial automáticamente y calibrar pesos con datos reales |
| 4 | Agentes de Copilot de la entidad con las mismas instrucciones y agentes personalizados |
| 5 | Segunda y tercera tribu. Panel de métricas |
| 6 | Evaluación de resultados y decisión de escalamiento |

## Métricas para demostrar impacto
Medir línea base antes del piloto y comparar después:
- Tiempo desde la solicitud hasta el pase aprobado.
- Porcentaje de pases rechazados o devueltos por falta de evidencias.
- Incidentes en producción originados por cambios.
- Tiempo del equipo en consultar estándares (encuesta corta).
- Satisfacción de los equipos (aporta al NPS de servicios CIO).
