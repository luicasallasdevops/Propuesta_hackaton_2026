---
applyTo: "docs/**/*.{js,html,css}"
---
- Solo nodos DOM y `textContent`; **prohibido `innerHTML`, `eval`, `new Function`** y recursos externos (CSP: `default-src 'none'; script-src 'self'`).
- `docs/engine.mjs`, `docs/flujo.mjs`, `docs/conversacion.mjs` y `docs/data/` son generados: edita `scripts/` o `knowledge/` y ejecuta `npm run build`.
- El chat (`agente-chat.js`, `ocd-assistant.js`) no decide permisos ni aprobaciones: delega en el motor.
- Accesibilidad: botones reales, foco visible, contraste en tema claro y oscuro, respeta `prefers-reduced-motion`.
- Un único aviso de «Entorno de demostración» en `index.html`; no repitas «simulado» en mensajes.
- Prueba en un navegador (`python3 -m http.server -d docs 8080`): el flujo del chat, el cambio de fecha y la pausa/retoma del OCD.
