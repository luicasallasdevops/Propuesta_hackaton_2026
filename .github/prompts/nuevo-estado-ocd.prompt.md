---
description: Agrega o modifica un estado del flujo OCD con sus pruebas y documentación
---
Quiero cambiar el flujo OCD: ${input:cambio:Describe el cambio (estado nuevo, actor, plazo, transición)}.

1. Lee `AGENTS.md` y `knowledge/ocd-flujo.json`.
2. Edita solo `knowledge/ocd-flujo.json` y, si hace falta, `knowledge/ocd-roles.json`. Cambia código únicamente si el JSON no alcanza.
3. Actualiza `tests/flujo.test.mjs` (y `tests/accion.test.mjs` si hay eventos de git).
4. Ejecuta `npm test` y `npm run build`.
5. Actualiza `documentacion/13-flujo-ocd.md`, `CHANGELOG.md` y la wiki (Flujo del OCD).
6. Resume qué cambió y cómo lo probaste.
