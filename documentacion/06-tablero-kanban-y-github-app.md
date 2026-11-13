# Tablero Kanban (GitHub Projects), token y recomendación de GitHub App

El pase a producción también se ve como un tablero Kanban en **GitHub Projects**: cada ticket `[Pase]` es una tarjeta que el agente mueve según el resultado de su evaluación. Los tickets `[OCD]` (pase con calendario, ver [documento 11](11-pase-ocd.md)) usan el mismo tablero y las mismas columnas.

## Columnas

| Columna | Significado | Quién la mueve |
|---|---|---|
| 📥 Solicitado | Ticket recibido, sin evaluar | Automático (al entrar) |
| 🚨 Bloqueado | El agente encontró bloqueos | **Agente** |
| ✅ Listo para aprobaciones | Sin bloqueos; faltan las aprobaciones del nivel de riesgo | **Agente** |
| 🔐 Aprobado | Todas las aprobaciones completas | Persona (arrastrando la tarjeta) |
| 🚀 En producción | Desplegado y cerrado | Automático al cerrar el ticket (flujo nativo de Projects) |

Regla de seguridad del agente: si una persona ya avanzó la tarjeta a *Aprobado* o *En producción*, el agente **no la vuelve a mover**.

## Cómo funciona
1. Al abrir o editar un ticket `[Pase]`, el agente evalúa y comenta (como siempre).
2. Un segundo trabajo, `tablero`, agrega la tarjeta al proyecto y la mueve a *Bloqueado* o *Listo para aprobaciones* (`scripts/kanban.mjs`).
3. Solo se procesan tickets de **OWNER, MEMBER o COLLABORATOR**: desconocidos reciben el informe, pero no llenan el tablero.

## Configuración del token (POC)
El `GITHUB_TOKEN` de Actions **no puede** acceder a Projects. Para un proyecto de usuario hace falta un token personal (classic) con **solo** el permiso `project`.

1. Crea el token: Settings → Developer settings → Tokens (classic) → permiso `project`, **con caducidad corta** (por ejemplo 30 días).
2. Guárdalo como **secreto del entorno** `kanban`: repositorio → Settings → Environments → `kanban` → *Add environment secret* → nombre **`GH_PROJECT_TOKEN`**.
3. El entorno `kanban` está limitado a la rama `main`: ninguna otra rama puede leer el secreto.
4. Nunca pegues el token en un ticket, chat o archivo.

Medidas aplicadas: secreto en entorno (no a nivel de repositorio), rama restringida, trabajo aislado con permisos mínimos, token solo por variable de entorno y nunca impreso, datos del ticket tratados solo como datos.

## Recomendación para producción: usar una GitHub App
Un token personal es práctico para una POC, pero en una organización bancaria se recomienda una **GitHub App** instalada en la organización. GitHub la recomienda para proyectos de organización.

| Aspecto | Token personal (POC) | GitHub App (producción) |
|---|---|---|
| Duración | Larga (días o meses) | **Token de instalación que expira en 1 hora** |
| Permisos | Amplio: `project` cubre todos tus proyectos | **Granulares**: solo Projects (escritura) e Issues (lectura) |
| Alcance | Toda tu cuenta | Solo la organización y los repositorios donde se instala |
| Identidad | Una persona: si se va, el flujo se rompe | **Identidad propia del proceso**, independiente de personas |
| Auditoría | Acciones atribuidas a un usuario | Acciones atribuidas a la App en el registro de auditoría |
| Rotación | Manual | Llaves privadas rotables sin tocar al usuario |
| Control | Lo crea cualquiera | Instalación aprobada por los dueños de la organización |
| Límites de uso | Los de un usuario | Escalan con la organización |

Beneficios en un banco:
- **Mínimo privilegio y segregación de funciones:** el agente solo puede lo que la App permite.
- **Menor impacto si se filtra:** un token de 1 hora es mucho menos valioso que uno personal.
- **Continuidad operativa:** no depende de la cuenta de una persona.
- **Trazabilidad para auditoría y cumplimiento:** cada movimiento queda atribuido al proceso.
- **Gobierno central:** los dueños de la organización controlan dónde se instala y qué permisos tiene.
- **Reutilizable por otras tribus:** una App por dominio, con el mismo patrón.

### Pasos de migración (≈ 1 día)
1. Mover el tablero a un proyecto de la **organización** (las Apps no acceden a proyectos de usuario).
2. Crear la GitHub App con permisos: *Projects: Read and write* e *Issues: Read-only*, e instalarla en el repositorio.
3. Guardar `APP_CLIENT_ID` (variable) y `APP_PRIVATE_KEY` (secreto del entorno `kanban`).
4. En `agente-pase.yml`, generar el token con `actions/create-github-app-token` y pasarlo como `GH_PROJECT_TOKEN` en lugar del secreto personal.
5. Agregar **revisores requeridos** en el entorno `kanban` si se quiere aprobación humana antes de mover tarjetas.
6. Revocar el token personal.

El script `scripts/kanban.mjs` no cambia: solo cambia de dónde sale el token.

## Mejora continua
- Medir el tiempo que pasa cada tarjeta en *Bloqueado* (campos de fecha e Insights de Projects).
- Agregar campos al tablero (riesgo, servicio, tribu) para vistas por área.
- Conectar el movimiento a *Aprobado* con las aprobaciones reales (ver [hoja de ruta](05-seguridad-decisiones-roadmap.md)).
