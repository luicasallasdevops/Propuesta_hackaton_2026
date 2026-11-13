# Mantener también el repositorio personal

Repositorio: https://github.com/luicasallasdevops/Propuesta_hackaton_2026 (remoto `origin`, rama `main`). El código es el mismo que el de Grupo11 (remoto `grupo11`): el portal calcula su repositorio desde su URL y los workflows usan `github.repository`, así que no hay nada que cambiar en los archivos.

## Cómo se sincroniza
La rama local `grupo11` contiene todo el historial, y `origin/main` (v1.2.0) es un ancestro: el envío es un avance rápido, sin conflictos.

```
git push origin grupo11:main
git push origin --tags
```
Después de cada versión nueva, repite los dos comandos junto con el push a `grupo11`.

## Configuración que no viaja con el código (una vez)
| Dónde | Qué |
|---|---|
| Settings → Pages | Source: **GitHub Actions** (el workflow `pages` publica el portal en `https://luicasallasdevops.github.io/Propuesta_hackaton_2026/`). |
| Settings → Actions → General | Permitir acciones de GitHub y del repositorio; aprobar workflows de externos. |
| Settings → Environments → `kanban` | Solo rama `main`, secret `GH_PROJECT_TOKEN` (permiso `project`). Sin el secret, el tablero se omite con un aviso. |
| Proyecto de GitHub | El tablero del usuario con número 1 (si es otro, cambia `PROJECT_NUMBER`). |
| Wiki | Crea la primera página desde la pestaña Wiki para activarla y publica las páginas con el script de la wiki apuntando a este repositorio. |

## Jira: solo en un repositorio
Las incidencias de Jira se identifican con la etiqueta `gh-ocd-<número del Issue>`. Si dos repositorios escriben en el mismo tablero KAN, el Issue #3 de uno chocaría con el #3 del otro. Por eso el entorno `jira` (con `JIRA_EMAIL` y `JIRA_API_TOKEN`) se configura **solo en Grupo11**. En el repositorio personal los jobs de Jira se omiten con un aviso y todo lo demás funciona igual.

## Verificación
1. Actions: `ci` y `pages` en verde tras el push.
2. El portal publicado abre y el chat responde.
3. Un Issue `[OCD]` (matrícula `M-10212`, historia `HU-3101`) recibe el informe del agente.
