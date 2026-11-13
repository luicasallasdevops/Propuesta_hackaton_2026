---
applyTo: "knowledge/**"
---
- Son la **fuente de verdad**; cambiarlos cambia el comportamiento del agente y del portal.
- Estándares `0*.md`: títulos de sección con `##` (el chat cita por sección). Español claro y corto.
- `ocd-flujo.json`: estados (`actor`, `siguiente`, `falla`, `devolver`, `salida`, `sla` en días hábiles), `modalidades`, `eventosGit`. Si agregas un estado, agrega su etiqueta `estado:<id>` y actualiza `tests/flujo.test.mjs`.
- `ocd-roles.json`: usuario de GitHub → roles. En la POC el usuario demo tiene los 6; no lo repliques en producción.
- `policy.json`: pesos y bloqueos del riesgo. Si cambias valores, ajusta las pruebas que los esperan.
- Valida que el JSON sea correcto: `npm run build` y `npm test`.
