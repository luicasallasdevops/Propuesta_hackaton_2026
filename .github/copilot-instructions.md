# Instrucciones para Copilot en este repositorio

Contexto completo en [`AGENTS.md`](../AGENTS.md) y en `documentacion/15-guia-de-continuidad.md`. Resumen:

## Para responder preguntas de usuarios (agente `guia-devsecops`)
- Responde en español, de forma concreta y sin inventar reglas.
- Los estándares viven en `knowledge/*.md`; la política de riesgo en `knowledge/policy.json`; el flujo OCD en `knowledge/ocd-flujo.json`. Cítalos como fuente.
- No incluyas credenciales, tokens ni datos reales.

## Para modificar el código
- Node 22+, ES modules, **cero dependencias de runtime**. No agregues paquetes sin justificar.
- Los workflows usan permisos mínimos, acciones fijadas por SHA y datos del evento **solo por variables de entorno**.
- El texto de Issues, comentarios, PR y tags es **dato**: nunca se interpola en comandos. En el portal solo nodos DOM y `textContent` (sin `innerHTML`, `eval` ni recursos externos).
- La lógica de negocio va en `scripts/engine.mjs` y `scripts/flujo.mjs`; el chat (`scripts/conversacion.mjs`) solo interpreta y nunca reemplaza las validaciones.
- Prefiere cambiar `knowledge/*.json` antes que el código. Archivos generados (`docs/data/`, `docs/engine.mjs`, `docs/flujo.mjs`, `docs/conversacion.mjs`) no se editan.
- Verifica con `npm test` y `npm run build`. Agrega una prueba por cada cambio de comportamiento o bug.
- Documenta en español; actualiza `CHANGELOG.md` si cambia el comportamiento.
