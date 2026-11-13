---
applyTo: ".github/workflows/**"
---
- `permissions: {}` por defecto y permisos explícitos por job; `persist-credentials: false` en `actions/checkout`.
- Acciones fijadas por **SHA completo** con la versión en un comentario (`# v7.0.1`). No uses `@v7` ni `@main`.
- Datos del evento (títulos, cuerpos, comentarios, nombres de rama, tags) **solo** vía `env:`; nunca `${{ github.event... }}` dentro de `run:`.
- Los jobs que mueven el tablero usan `environment: kanban` (solo rama `main`) y `GH_PROJECT_TOKEN`; los eventos de PR/tag no pueden usarlo: usa el job `sincronizar`.
- `ocd-flujo.yml` usa concurrencia por Issue: no asumas que dos eventos seguidos se ejecutan ambos.
- Define `timeout-minutes` y versión de Node 22.
