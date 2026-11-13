# Flujo del OCD: estados, roles y modalidades

El flujo vive en **un solo archivo de datos**: `knowledge/ocd-flujo.json`. El agente, el chat, el simulador de Jira, el tablero y los workflows lo leen. Si el flujo cambia, se edita ese archivo y no el código.

## Modalidades
| Modalidad | Quién ejecuta | Cómo se validan las instrucciones |
|---|---|---|
| Automatizado | Todo se ejecuta solo | Todos los pasos deben ser `[AUTO]` o mencionar un workflow, pipeline o script. Un paso `[MANUAL]` bloquea |
| Manual | AgileOps a mano | Pasos numerados. Un paso `[AUTO]` genera un aviso |
| Híbrido | Mezcla | Cada paso lleva `[AUTO]` o `[MANUAL]`. Un estado es automático solo si todos los pasos de su conjunto son `[AUTO]` |
| DeployGO | Eventos de git | Igual que Automatizado. Nace de la historia y los estados los mueven PR y tags, no personas |

> En la POC «Tipo de cambio» (Estándar, Normal, Emergencia) sigue siendo lo que decide el calendario. La **modalidad** decide quién ejecuta.

## Los cuatro conjuntos de instrucciones
Congelamiento, despliegue, reversión de congelamiento y reversión de despliegue. Los cuatro se revisan por credenciales y comandos peligrosos; el de despliegue además exige rollback y verificación posterior. Faltar alguno no bloquea al crear el OCD, pero impide pasar a Revisiones técnicas.

## Estados y quién los mueve
| # | Estado | Lo mueve | Si falla |
|---|---|---|---|
| 1 | Inicio codificación | Developer | |
| 2 | Revisiones técnicas | Líder técnico | Devolver a Inicio |
| 3 | Aprobación de seguridad | Analista de seguridad | Devolver a Inicio |
| 4 | Congelamiento (certificación) | AgileOps (automático si la modalidad lo permite) | Reversión de congelamiento |
| 5 | Reversión de congelamiento (rama) | AgileOps | Vuelve a Inicio |
| 6 | Gestión de pase (calendario y 4 aprobaciones: Gestor del pool, Líder técnico, CL-DEV, Gobierno de Gestión de Cambios) | Gestor de cambios | |
| 7 | Ejecución pase a producción | AgileOps (automático si la modalidad lo permite) | Reversión de pase |
| 8 | Reversión de pase a producción (rama) | AgileOps | Pasa a Reversión |
| 9 | Ratificación | QE | Reversión de pase |
| 10 | Reversión (rama) | QE ratifica la reversión | |
| 11 | Done | AgileOps (cierra el Issue) | |

Requisitos que el agente comprueba al salir de **Inicio**: los cuatro conjuntos completos y válidos, y el OCD sin bloqueos.

## Cómo se usa en GitHub
Todo se hace comentando en el Issue `[OCD]`. Solo funcionan para OWNER, MEMBER o COLLABORATOR y el agente comprueba el rol del usuario en `knowledge/ocd-roles.json`.

| Comando | Qué hace |
|---|---|
| `/ocd estado` | Muestra el estado, los requisitos, las instrucciones y cómo moverlo |
| `/ocd mover <estado>` | Mueve el OCD (por id o nombre: `revisiones`, `gestión de pase`…) |
| `/ocd mover <estado> falla` | Si el estado es automático, simula que falla y lo lleva por la reversión |
| `/ocd falla` | Reporta falla desde Congelamiento, Ejecución o Ratificación |
| `/ocd devolver` | Devuelve el OCD a Inicio desde Revisiones o Seguridad |

El estado vive en las etiquetas `estado:*`; la modalidad, en `modalidad:*`. Al pasar a Done el Issue se cierra.

> **Roles en la POC:** el usuario de demostración tiene los 6 roles para poder recorrer el flujo. Para ver el control de roles, edita `ocd-roles.json` y deja a ese usuario con menos roles. En producción los roles vendrían de Jira, del IAM o de equipos de GitHub.

## DeployGO (eventos de git)
Solo aplica a OCD con modalidad DeployGO. Los estados no avanzan solos: los mueve el evento.

| Evento | Pasa de → a | Quién |
|---|---|---|
| Se crea una historia `[HU-3101] ...` | (nace el OCD) → Inicio | Cualquiera del equipo |
| Se abre un PR que menciona `OCD #N` | Inicio → Revisiones técnicas | Developer |
| El líder técnico aprueba el PR | Revisiones → Seguridad | Líder técnico |
| El analista de seguridad aprueba el PR | Seguridad → Congelamiento | Analista de seguridad |
| Tag `ocd-N-cert` | Congelamiento → Gestión de pase | AgileOps |
| Tag `ocd-N-prod` | Gestión de pase → Ejecución | Gestor de cambios |
| Tag `ocd-N-ratificado` | Ratificación → Done | QE |
| Tag `ocd-N-revertir` | Ejecución o Ratificación → Reversión de pase | AgileOps o QE |

El Issue que crea la historia lo crea el `GITHUB_TOKEN`, que no dispara otros workflows: el agente lo evalúa la primera vez que alguien lo edita para completar los datos.

## Avisos y tablero
- **Avisos:** cada día hábil el workflow revisa los OCD abiertos. Si uno lleva más días hábiles de los previstos en su estado, comenta una sola vez por día y estado, y menciona al rol que debe actuar.
- **Tablero:** la tarjeta sigue al estado. Con las 5 columnas actuales cada estado cae en su columna agrupadora (Solicitado, Listo para aprobaciones, Aprobado, En producción). Si creas columnas con el nombre exacto de un estado, la tarjeta irá a esa columna. Los eventos de git no pueden usar el entorno `kanban` (solo admite `main`), así que un job diario o manual (`workflow_dispatch`) alinea las tarjetas.

## Supuestos (confirmar con el negocio)
1. El Product Owner no aprueba la Gestión de pase: aprueban Gestor del pool, Líder técnico, CL-DEV y Gobierno de Gestión de Cambios. El PO sigue en el calendario del OCD de la versión 1.1 hasta que se confirme.
2. El puntaje de riesgo y el Delegado CIO se mantienen como estaban.
3. La modalidad la elige el developer al crear el OCD (el agente avisa si las instrucciones no la respetan).
4. La reversión de congelamiento y la de pase las dispara quien reporta la falla (`/ocd falla` o el tag `revertir`); en modalidades automáticas, la propia cadena automática.
5. El estado «Reversión» lo ratifica el QE.
6. Las reglas de calendario (ventana, cupo, CAB) siguen aplicando para reservar la noche de Gestión de pase.

## Cómo cambiar el flujo
Edita `knowledge/ocd-flujo.json` (estados, actores, requisitos, plazos en días hábiles, eventos de git) y `knowledge/ocd-roles.json` (usuarios y roles); ejecuta `npm test` y `npm run build`.
