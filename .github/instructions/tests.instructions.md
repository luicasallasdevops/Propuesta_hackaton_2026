---
applyTo: "tests/**"
---
- `node:test` y `node:assert/strict`, sin librerías extra.
- Prueba funciones puras; para datos usa los JSON de `knowledge/` con una fecha de referencia fija (`2026-11-16`, lunes).
- Cada bug corregido deja una prueba que lo habría detectado.
