# Seguridad

POC de hackathon con **datos simulados**. No incluir credenciales ni datos reales en issues, código o commits.

## Reportar una vulnerabilidad
Usa *Security → Report a vulnerability* de este repositorio (reporte privado) o el canal interno de SecOps. No abras un Issue público con detalles.

## Medidas aplicadas
- Acciones de GitHub **fijadas por SHA** con su versión en un comentario; Dependabot las actualiza cada semana.
- Permisos mínimos por trabajo (`permissions: {}` por defecto) y `persist-credentials: false`.
- El texto de los tickets se trata solo como dato: nunca se interpola en comandos.
- Token del tablero (`GH_PROJECT_TOKEN`) como secreto del entorno `kanban`, limitado a `main`, nunca impreso.
- Solo tickets de OWNER, MEMBER o COLLABORATOR llegan al tablero.
- Portal con CSP estricta, sin CDN ni `innerHTML`.
- Análisis de código con CodeQL en cada cambio.

Detalle y recomendaciones para producción: [documentación 08](documentacion/08-analisis-funcional-y-seguridad.md).
