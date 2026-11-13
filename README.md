# Asistente DevSecOps · Anticiparse a los problemas

POC del hackathon DevSecOps 2026. Un agente que guía al equipo por los estándares de la entidad, valida el pase a producción antes de que falle y entrega plantillas seguras listas para usar. **Todo el contenido (políticas, incidentes, roles) es simulado.**

> **Versión 0.1.0 (POC)** · [Qué hace y qué resuelve, en simple](documentacion/00-resumen-simple.md)
>
> Documentación completa para el equipo en [`documentacion/`](documentacion/README.md): contexto, arquitectura, guion de demo, guía para equipos y hoja de ruta.

## El problema
Los equipos tardan semanas en entender cómo crear tickets, qué roles pedir, qué grupos de red y licencias necesitan y qué evidencias de seguridad exigir. Los incidentes pasados no se usan para prevenir los siguientes.

## La solución
| Pieza | Qué hace | Dónde |
|---|---|---|
| Portal (GitHub Pages) | Chat con citas de la fuente, validador de pase y plantillas con botón Copiar | `docs/` |
| Agente en Actions | Al abrir un ticket de pase evalúa riesgo, bloquea incumplimientos, etiqueta y comenta | `.github/workflows/agente-pase.yml`, `scripts/agent.mjs` |
| Base de conocimiento | Estándares en Markdown versionados, política de riesgo e historial de incidentes | `knowledge/` |
| Plantillas SecOps | CI de seguridad (CodeQL, Dependency Review), release protegido, Dependabot | `templates/` |
| Agentes de Copilot | Instrucciones y agente personalizado que leen la misma base de conocimiento | `.github/copilot-instructions.md`, `.github/agents/` |

## Empieza aquí
Abre el portal y entra a la pestaña **Guía paso a paso**: 8 pasos con botones que cargan el caso riesgoso y el camino feliz, abren el ticket precargado y muestran en vivo las ejecuciones del agente.

## Demo en 3 minutos
1. Abrir el portal y preguntar "¿Cómo creo un ticket de pase?" y "Dame un workflow de CodeQL".
2. En "Validar mi pase", dejar los valores por defecto (viernes, sin rollback, pagos-api) y evaluar: sale Bloqueado y Crítico, con acciones preventivas y los incidentes que lo respaldan.
3. Abrir un Issue con el formulario "Pase a Producción": en segundos el agente comenta el informe y pone etiquetas.
4. Corregir el cambio (martes, rollback probado, controles marcados) y editar el Issue: el informe se actualiza a Listo para aprobaciones.

## Activación (una vez)
1. Repo > Settings > Pages > Source: **GitHub Actions**.
2. Para producción real: activar GHAS, Push Protection y reglas de rama sobre `main`.

## Seguridad aplicada
Permisos mínimos por job, el texto del Issue se trata solo como dato (nunca se interpola en comandos), menciones y HTML neutralizados en los comentarios, portal con CSP estricta y sin dependencias externas, acciones actualizadas por Dependabot, CodeQL sobre el propio repo, `persist-credentials: false` y cero dependencias de runtime.

## Cómo encaja en los criterios
- **IA agéntica:** el agente recupera política, razona sobre historial, decide bloqueo y actúa en el Issue (etiquetas y comentario).
- **Experiencia de usuario:** una pregunta o un formulario, respuesta inmediata, accesible y con tema oscuro.
- **Impacto:** menos semanas de espera, menos retrabajo, menos fallas por pases mal preparados.
- **Factibilidad y escalabilidad:** GitHub nativo, sin infraestructura extra; otras tribus solo cambian `knowledge/`.
- **Bonificaciones:** productividad en SDLC, reducción de riesgo en producción, reutilizable por tribus, implementable en menos de 6 meses, mejora del NPS de servicios CIO.

## Desarrollo
```
npm test        # pruebas del motor
npm run build   # genera docs/data y copia el motor al portal
python3 -m http.server -d docs 8080
```
Siguientes pasos: conectar el tablero Kanban y la gestión de incidentes por API, y alimentar `incidents.json` automáticamente.

## Agentes de GitHub y su costo (validado el 12-nov-2026)
| Capacidad | Plan Free | Uso en esta POC |
|---|---|---|
| GitHub Models (API de inferencia) | **Retirado el 30-jul-2026**, ya no existe | No se usa. Se retiró del agente |
| Copilot Free: modo agente en el IDE, CLI, instrucciones y agentes personalizados | Sí, con créditos limitados | `.github/copilot-instructions.md` y `.github/agents/guia-devsecops.agent.md` |
| Copilot cloud agent (antes coding agent) y code review | No, requiere plan de pago | Fuera de la POC. La entidad ya lo tiene con Copilot Business o Enterprise |

Cómo funciona la parte agéntica sin costo: en Actions el agente razona con reglas deterministas, historial y política (sin LLM), y en el IDE los agentes de Copilot leen los mismos archivos. Un resumen generado por LLM dentro de Actions necesitaría una clave de un proveedor de pago o Copilot de la entidad. Se deja como mejora futura.
