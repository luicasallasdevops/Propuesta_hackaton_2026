# Red, grupos y conectividad

> Contenido SIMULADO para la POC.

## Grupos de red necesarios
- `net-github-runners`: salida de los runners hacia el registro de artefactos y ambientes.
- `net-artifact-registry`: acceso al repositorio interno de artefactos e imágenes.
- `net-prod-deploy`: conectividad hacia ambiente de producción. Solo para el workflow de release.

## Cómo solicitarlos
1. Abrir ticket "Solicitud de red" con servicio, origen, destino, puerto y justificación.
2. Aprobación del líder técnico y del equipo de seguridad de red.
3. Tiempo estimado: 3 días hábiles. Solicitar antes del ticket de pase.

## Runners
- Los runners alojados por GitHub se usan solo para pruebas y análisis sin acceso a la red interna.
- El despliegue a producción usa runners autoalojados en la red de la entidad.
