# Herramientas de seguridad (DevSecOps)

## Controles obligatorios en el pipeline
- SAST: análisis estático con CodeQL en cada pull request y en `main`.
- SCA: revisión de dependencias con Dependency Review en cada pull request y Dependabot para actualizaciones.
- Secretos: Secret Scanning con Push Protection activado en el repositorio.
- Contenedores: escaneo de imágenes con Trivy antes de publicar (si el servicio usa contenedores).
- IaC: escaneo de Terraform y Kubernetes con Checkov o Trivy config.

## Licencias requeridas
- GitHub Enterprise Cloud: licencia de usuario activa asignada por el equipo de plataforma.
- GitHub Advanced Security (GHAS): necesaria para CodeQL y Secret Scanning en repositorios privados.
- Verificar la licencia con plataforma antes de abrir el ticket de pase.

## Cómo consumir las plantillas oficiales
- Copiar los workflows de la carpeta de plantillas del portal al directorio `.github/workflows` del repositorio.
- No modificar los permisos mínimos ni los umbrales sin aprobación de SecOps.
- Usar versiones recientes de las acciones y mantener Dependabot activo para acciones.
- Pasar los datos del evento mediante variables de entorno, nunca interpolados directamente en el script.

## Umbrales de severidad
- Crítica o alta: bloquea el pase.
- Media: requiere plan de remediación con fecha.
- Baja: se registra en el backlog.
