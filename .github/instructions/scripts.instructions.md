---
applyTo: "scripts/**"
---
- Sin dependencias; ES modules; funciones **puras** para decidir (`flujo.mjs`, `ocd-accion.mjs`, `conversacion.mjs`) y efectos solo en los runners (`ocd-flujo.mjs`, `agent.mjs`, `kanban.mjs`).
- `engine.mjs`, `flujo.mjs` y `conversacion.mjs` también corren en el navegador: no uses APIs exclusivas de Node en ellos.
- Llama a `gh` con `execFileSync("gh", [args])`, sin shell. Nunca imprimas tokens.
- Trata todo texto de usuario como dato: neutraliza menciones y HTML con `esc` antes de publicarlo.
- Solo OWNER, MEMBER o COLLABORATOR pueden accionar comandos; los roles se validan con `ocd-roles.json`.
- Toda función nueva lleva prueba en `tests/`.
