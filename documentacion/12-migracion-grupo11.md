# Migración al repositorio Grupo11 (organización hybridcloudcompany)

Repositorio: https://github.com/hybridcloudcompany/Grupo11 (privado). Mismo código de la v1.2.0-poc, mismas credenciales SSH (`luiscasallasdevops_personal`).

## Qué cambió en el código
- `scripts/kanban.mjs` ahora funciona con tableros de personas y de organizaciones (`repositoryOwner`).
- El portal calcula el repositorio desde su URL; los valores de respaldo y los enlaces de la documentación apuntan a Grupo11.
- El enlace al tablero usa `orgs/` o `users/` según el dueño.

## Configuración que no viaja con el código (hacer una vez)
| Dónde | Qué | Por qué |
|---|---|---|
| Settings → Pages | Source: **GitHub Actions** | Publica el portal con `pages.yml`. |
| Settings → Actions → General | Permitir solo acciones de GitHub y las del repositorio; aprobar workflows de externos | Reduce riesgo de cadena de suministro. |
| Settings → Environments | Crear `kanban`, solo rama `main`, con el secret `GH_PROJECT_TOKEN` | Solo el job del tablero ve el token. |
| Proyecto de la organización | Copiar el tablero (Make a copy) y dejarlo con el número 1 | Si el número es otro, cambiar `PROJECT_NUMBER` en `agente-pase.yml`. |
| Settings → Advanced Security | Dependency graph, Dependabot alerts, secret scanning y push protection, reporte privado de vulnerabilidades | Mismas protecciones de la v1.0.0. |
| Settings → Rulesets (opcional) | Proteger `main` | Recomendado para producción. |

## Token del tablero
Crea un token (classic) solo con el permiso `project`, desde la cuenta con acceso al proyecto de la organización. Pégalo directamente en Settings → Environments → kanban → Secrets. Nunca en chat ni en archivos.

## Límites en repositorio privado
- El portal es público aunque el repositorio sea privado, pero sus consultas a la API de GitHub (ejecuciones y tickets en vivo) devuelven 404: la guía muestra un aviso y remite a la pestaña Actions.
- El tablero hereda la visibilidad que le des en la organización.

## Verificación
1. Pages y CI en verde tras el push.
2. Abrir un Issue `[OCD]` con matrícula `M-10212` e historia `HU-3101`: el agente comenta y la tarjeta cae en Listo para aprobaciones.
