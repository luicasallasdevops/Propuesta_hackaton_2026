# Roles y accesos en GitHub

## Roles disponibles en el repositorio
- Read: consulta de código e issues. Rol por defecto para equipos de otras áreas.
- Triage: gestiona issues y pull requests sin escribir código.
- Write: desarrolladores del squad. Pueden crear ramas y abrir pull requests.
- Maintain: líder técnico. Gestiona el repositorio sin acceso a ajustes sensibles.
- Admin: solo SecOps y plataforma. No se asigna a desarrolladores.

## Cómo solicitar un rol
1. Pertenecer al grupo de directorio corporativo del squad (por ejemplo `grp-squad-pagos`).
2. Abrir un ticket de tipo "Solicitud de acceso" indicando repositorio, rol y justificación.
3. Aprobación del líder técnico del squad. Para Maintain se requiere además SecOps.
4. El acceso se asigna por equipo de GitHub, nunca por usuario individual.

## Reglas de seguridad de cuentas
- Autenticación multifactor obligatoria y acceso por SSO.
- Llaves SSH o tokens de acceso con vigencia máxima de 90 días.
- Prohibido usar cuentas personales para repositorios de la entidad.
- Revisión trimestral de accesos por parte del líder técnico.

## Ambientes y aprobadores
- Ambiente `dev`: sin aprobación.
- Ambiente `qa`: aprobación del squad de QA.
- Ambiente `production`: aprobadores requeridos (QA y líder técnico) y rama protegida `main`.
