---
description: Mejora la comprensión o los diálogos del asistente conversacional sin saltarse las validaciones
---
Mejora pedida: ${input:mejora:Qué frases o flujos debe entender mejor el chat}.

1. Lee `AGENTS.md`, `scripts/conversacion.mjs`, `docs/agente-chat.js` y `docs/ocd-assistant.js`.
2. Agrega la comprensión en `scripts/conversacion.mjs` (puro y probado) y los diálogos en `docs/agente-chat.js`. Solo `textContent`, sin `innerHTML`.
3. El chat **no** decide riesgo, permisos ni aprobaciones: llama al motor.
4. Agrega casos a `tests/conversacion.test.mjs` y prueba en el navegador: saludo, frase libre, cambio de fecha a mitad, pregunta intermedia y retomar.
5. Si propones un LLM, que solo interprete la intención y devuelva datos estructurados que el motor valida.
