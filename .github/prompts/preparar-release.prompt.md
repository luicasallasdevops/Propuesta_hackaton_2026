---
description: Prepara una versión estable (verificación, CHANGELOG, tag y notas del release)
---
Prepara la versión ${input:version:vX.Y.Z-poc}.

1. `npm test` y `npm run build` en verde; CI y Pages verdes en `main`.
2. Valida en vivo en el repo (checklist de la wiki, página Pruebas): Issue `[OCD]`, `/ocd mover`, cadena automática, falla → reversión y Done.
3. Sube la versión en `package.json` y completa `CHANGELOG.md`.
4. Redacta las notas del release a partir del CHANGELOG (novedades, validación en vivo, límites conocidos).
5. Indica los comandos para crear el tag anotado y publicarlo. No incluyas tokens.
