# Configuración de seguridad del repositorio: paso a paso y por qué

Todas las rutas son del repositorio en GitHub (`Settings` = pestaña de ajustes). Fecha: 2026-11-13. Cada punto dice **dónde**, **qué se configuró**, **por qué** y **cómo comprobarlo o revertirlo**.

## 1. Entorno `kanban` y su secreto
- **Dónde:** Settings → Environments → New environment → `kanban`.
- **Qué:** se creó el entorno, se restringió a la rama `main` (*Deployment branches and tags → Selected branches → `main`*) y se agregó el secreto `GH_PROJECT_TOKEN`.
- **Por qué:** el `GITHUB_TOKEN` de Actions no accede a Projects. El token personal es poderoso; guardarlo en un entorno limitado a `main` evita que otra rama o un workflow no revisado lo lea. Solo el trabajo `tablero` declara ese entorno.
- **Comprobar:** Settings → Environments → `kanban` muestra la regla de `main` y el nombre del secreto (nunca su valor).
- **Revertir:** borrar el secreto y revocar el token en *Developer settings → Tokens*.

## 2. Solo acciones de GitHub, fijadas por SHA
- **Dónde:** Settings → Actions → General → *Actions permissions*.
- **Qué:** opción *Allow … select non-… actions*, marcado **Allow actions created by GitHub** y **Require actions to be pinned to a full-length commit SHA**. En los workflows, cada acción lleva su SHA con la versión en un comentario (`@3d3c42e… # v7.0.1`).
- **Por qué:** una etiqueta (`@v7`) puede moverse a otro código; un SHA no. Así un compromiso de una acción de terceros no llega a nuestros workflows. Dependabot propone las actualizaciones cada semana.
- **Comprobar:** un workflow con `uses: …@v7` falla al iniciarse.
- **Revertir:** desmarcar las dos casillas. No recomendado.

## 3. Aprobación de workflows de colaboradores externos
- **Dónde:** Settings → Actions → General → *Approval for running fork pull request workflows*.
- **Qué:** *Require approval for all outside collaborators*.
- **Por qué:** en un repositorio público, cualquiera puede abrir un pull request que ejecuta workflows. Con aprobación manual, nadie externo gasta minutos ni ejecuta código sin revisión.

## 4. Permisos por defecto del `GITHUB_TOKEN`
- **Dónde:** Settings → Actions → General → *Workflow permissions*.
- **Qué:** *Read repository contents* (ya estaba así) y cada workflow declara sus permisos mínimos (`permissions: {}` global y permisos por trabajo).
- **Por qué:** mínimo privilegio: un trabajo comprometido solo puede lo que su permiso permite.

## 5. Advanced Security (gratis en repositorios públicos)
- **Dónde:** Settings → Advanced Security.
- **Qué y por qué:**

| Ajuste | Por qué |
|---|---|
| Private vulnerability reporting | Quien encuentre una falla puede avisar en privado, sin publicarla |
| Dependency graph | Mapa de dependencias; base de las demás alertas |
| Dependabot alerts | Avisa si una dependencia tiene una vulnerabilidad conocida |
| Secret Protection (secret scanning) | Detecta credenciales expuestas en el código |
| Push protection | **Bloquea** el push si contiene un secreto soportado |
| CodeQL (ya activo por workflow) | Análisis estático en cada cambio |
| Copilot Autofix (ya activo) | Sugiere correcciones de las alertas de CodeQL |

- **Comprobar:** cada interruptor aparece en *On* en esa página.

## 6. Dependabot para las acciones
- **Dónde:** `.github/dependabot.yml`.
- **Qué:** ecosistema `github-actions`, cada semana.
- **Por qué:** con SHA fijos, las versiones no se actualizan solas; Dependabot abre un pull request con el nuevo SHA y su versión.

## 7. Tablero de Projects
- **Dónde:** Projects → el tablero → Settings → Visibility.
- **Qué:** público, con descripción y README; el token solo se usa desde el entorno `kanban`.
- **Por qué:** para poder explicarlo en la demo. Contiene solo tarjetas de tickets de demostración (datos simulados).
- **Revertir:** cambiar a *Private* en la misma página.

## 8. Regla de acceso al tablero desde el agente
- **Dónde:** `.github/workflows/agente-pase.yml` (trabajo `tablero`).
- **Qué:** solo corre para tickets de OWNER, MEMBER o COLLABORATOR y no mueve tarjetas ya avanzadas por personas.
- **Por qué:** evita que desconocidos llenen el tablero y respeta el trabajo humano.

## 9. Pendiente para producción
- **Ruleset en `main`** (Settings → Rules → Rulesets): pull request obligatorio, revisiones, checks requeridos y bloqueo de force push. No se aplicó en la POC porque el flujo es push directo.
- **GitHub App** en lugar del token personal ([documento 06](06-tablero-kanban-y-github-app.md)).
- **Fijar la imagen del ejecutor** (`ubuntu-latest` migra a Ubuntu 26).

## 10. Visibilidad del repositorio: qué cambia si se hace privado
- **Cómo:** Settings → General → Danger Zone → *Change visibility*.
- **GitHub Pages:** en cuentas gratuitas, Pages solo funciona en repositorios públicos; al hacerlo privado, el portal deja de estar publicado. Al volver a público hay que volver a ejecutar el workflow `pages`.
- **Advanced Security:** las protecciones gratuitas (alertas, escaneo de secretos, push protection) son para repositorios públicos; en privados requieren licencia.
- **Tablero:** las tarjetas de un repositorio privado solo las ven quienes tienen acceso al repositorio.
- **Lo ya publicado no se retira:** copias o clones hechos antes siguen existiendo. A 2026-11-13 el repositorio tiene 0 forks, 0 estrellas y 0 seguidores.
