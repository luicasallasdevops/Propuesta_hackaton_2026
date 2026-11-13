---
description: Ajusta la política de riesgo, un bloqueo o una regla de calendario con pruebas
---
Cambio pedido: ${input:cambio:Describe la regla (peso, control, bloqueo, ventana, cupo, feriado)}.

1. Lee `AGENTS.md`, `knowledge/policy.json` y `knowledge/ocd.json`.
2. Modifica el JSON correspondiente; solo toca `scripts/engine.mjs` si la regla no se puede expresar en datos.
3. Ajusta o agrega pruebas en `tests/engine.test.mjs` / `tests/ocd.test.mjs`.
4. Ejecuta `npm test` y `npm run build`; revisa en el portal que el validador y el chat dan el resultado esperado.
5. Documenta en `CHANGELOG.md` y en la wiki (Riesgo y bloqueos / Calendario del OCD).
