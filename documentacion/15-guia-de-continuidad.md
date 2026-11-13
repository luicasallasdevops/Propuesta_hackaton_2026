# Guía de continuidad para el equipo

Documento para quien continúe las mejoras (por ejemplo con GitHub Copilot). Complementa `AGENTS.md` (reglas para agentes de código) y la wiki del repositorio (uso y mantenimiento).

## 1. Qué estamos construyendo y por qué
Un agente que **anticipa problemas del pase a producción** y acompaña el OCD de punta a punta. Criterios de evaluación del hackathon: IA agéntica, prototipo y experiencia de usuario, impacto en ingeniería/negocio, innovación y factibilidad/escalabilidad. Bonificaciones: productividad en el SDLC, menos riesgo en producción, reutilización entre tribus, implementable en ≤ 6 meses y mejora del NPS de servicios CIO.

Decisiones de diseño y su razón:
| Decisión | Razón |
|---|---|
| Agente **determinista**, sin LLM en Actions | Auditable, reproducible, sin enviar datos a terceros ni claves. GitHub Models se retiró el 30-jul-2026 |
| Un **motor único** (`engine`, `flujo`, `conversacion`) para navegador y Actions | El portal y el agente real dan el mismo resultado |
| Flujo como **datos** (`knowledge/ocd-flujo.json`) | Cambiar estados, actores o plazos sin tocar código |
| *Decide* (puro) y *ejecuta* (efectos) separados | Casi todo se prueba sin GitHub |
| Todo en GitHub (Issues, Actions, Pages, Projects) | Sin infraestructura nueva; reutilizable por otras tribus |
| Cero dependencias, acciones por SHA, CSP estricta | Sin deuda técnica y superficie de ataque mínima |

## 2. Cómo se llegó aquí (versiones)
| Versión | Qué se hizo |
|---|---|
| 0.x – 1.0 | Chat con estándares citados, validador de riesgo (0-100), plantillas seguras, tablero Kanban, endurecimiento de seguridad |
| 1.1 | Pase OCD con calendario (ventana, cupo, Comité de Gestión de Cambios, feriados), aprobadores y simulador de Jira |
| 1.2 | Escenarios del chat: grupos de red DevSecOps por matrícula, historia, instrucciones; migración a `hybridcloudcompany/Grupo11` |
| 1.3 | Flujo OCD real: 11 estados, 6 roles, 4 modalidades, comandos `/ocd`, DeployGO por eventos de git, avisos |
| 1.4 | Asistente conversacional: frases libres, contexto, traza de lo que hizo el agente, aviso único de «Entorno de demostración» |

Cada versión tiene su detalle en `CHANGELOG.md` y su documento en `documentacion/`.

## 3. Estado de validación (13-nov-2026)
| Área | Estado |
|---|---|
| CI, Pages, pruebas (64) | ✅ |
| Agente `[OCD]` Híbrido y Automatizado en vivo | ✅ |
| `/ocd mover`, cadena automática, falla → reversión, Done cierra el Issue | ✅ en vivo en Grupo11 |
| Asistente conversacional | ✅ probado en navegador local; **pendiente** probarlo en el portal publicado |
| DeployGO (historia `[HU-####]`, PR con `OCD #N`, tags `ocd-N-*`) | ⏳ solo pruebas unitarias |
| Job `avisos` y job `sincronizar` (`workflow_dispatch`) | ⏳ solo pruebas unitarias |
| Rechazo por rol en vivo | ⏳ el usuario demo tiene los 6 roles |

## 4. Backlog sugerido (en orden)
1. **Validar en vivo lo pendiente** (sección 3). *Hecho cuando:* cada fila pasa a ✅ y se anota en el CHANGELOG.
2. **Repartir roles reales** en `knowledge/ocd-roles.json` y probar el rechazo por rol. *Hecho cuando:* un usuario sin el rol recibe ⛔ en el Issue.
3. **Sustituir el token personal por una GitHub App** (token de 1 hora, permisos granulares). *Hecho cuando:* `GH_PROJECT_TOKEN` personal está revocado y el tablero sigue funcionando.
4. **Integrar Jira y Helpdesk por API** (hoy son demostrativos). *Hecho cuando:* el OCD nace de un ticket real de Jira y las solicitudes de grupos de red se crean en Helpdesk.
5. **Roles desde Jira/IAM o equipos de GitHub** en lugar de `ocd-roles.json`.
6. **Calendario y catálogo reales** (Change Management, historias de usuario).
7. **Capa opcional de LLM** que solo interprete frases ambiguas y devuelva datos estructurados; el motor valida todo. Requiere decidir proveedor/clave (o Copilot de la entidad) y qué datos pueden salir.
8. **Columnas del tablero por estado** (hoy 5 columnas agrupadoras) y ruleset en `main`.
9. **Métricas de impacto** (tiempo de pase, % devueltos por falta de evidencias, incidentes por cambios) con línea base.

## 5. Cómo trabajar (flujo recomendado)
1. Crea una rama desde `main` y lee `AGENTS.md`.
2. Con Copilot Chat puedes usar los prompts de `.github/prompts/` (`nuevo-estado-ocd`, `nueva-regla-riesgo`, `mejorar-chat`, `preparar-release`) y se aplican solas las instrucciones por carpeta de `.github/instructions/`.
3. Cambia primero `knowledge/` si es regla o flujo; código solo si hace falta.
4. `npm test && npm run build`; prueba el portal en local (`python3 -m http.server -d docs 8080`).
5. Abre un PR pequeño; CI debe quedar verde. Tras el merge, Pages se republica solo.
6. Para validar en vivo usa Issues de prueba y deja ~45 s entre comandos `/ocd` del mismo Issue; cierra los Issues de prueba al terminar.
7. Para versionar: `package.json`, `CHANGELOG.md`, tag anotado `vX.Y.Z-poc` y Release con las notas.

## 6. Accesos y configuración del repositorio (sin secretos)
- Repositorio: `hybridcloudcompany/Grupo11` (privado). Portal en GitHub Pages (público aunque el repo sea privado: **no publiques datos reales**).
- Tablero: proyecto 1 de la organización `hybridcloudcompany`.
- Settings que deben existir: Pages con fuente *GitHub Actions*; entorno `kanban` limitado a `main` con el secreto `GH_PROJECT_TOKEN`; variable `PROJECT_OWNER`; solo acciones de GitHub y SHA obligatorio; aprobación de workflows de colaboradores externos.
- El token del tablero necesita acceso al repo (Issues y Metadata de lectura) y a Projects de la organización (lectura y escritura). Si caduca, solo se detiene el tablero. **Nunca** lo pegues en Issues, chats ni archivos.
- CodeQL se activa con la variable `CODEQL_ENABLED=true` (requiere Code Security).

## 7. Riesgos y límites que conviene recordar
- Datos del entorno de demostración (directorio, historias, calendario, incidentes) son de ejemplo.
- El puntaje de riesgo es una heurística, no un modelo entrenado.
- Sin secret scanning ni push protection en el repo privado (requieren licencia).
- Seis supuestos del flujo están pendientes de confirmar con el negocio (ver `13-flujo-ocd.md`).
- El Issue creado desde una historia no dispara al agente hasta que se edita (limitación del `GITHUB_TOKEN`).

## 8. Dónde mirar cuando algo falla
Actions → ejecución fallida → job. La wiki tiene la página **Solución de problemas** con síntomas y causas frecuentes.
