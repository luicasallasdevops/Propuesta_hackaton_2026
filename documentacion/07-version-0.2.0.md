# Versión 0.2.0 (POC): qué hay de nuevo, qué resuelve y cómo funciona

Resumen sencillo para quien no es técnico. Complementa la [versión 0.1.0](00-resumen-simple.md). Todo el contenido de ejemplo es **simulado**.

## En una frase
Lo mismo que antes (revisar un cambio antes de producción y avisar qué puede fallar) y ahora **también se ve y se sigue en un tablero Kanban**, donde el agente coloca cada pase según su riesgo.

## El problema que ya resolvía la 0.1.0
Los equipos descubrían tarde lo que les faltaba para un pase a producción. La 0.1.0 lo anticipa: responde con el estándar, calcula el riesgo y comenta el ticket.

## El problema nuevo que resuelve la 0.2.0
Un informe en un comentario sirve al equipo, pero **no da visibilidad de conjunto**: ¿cuántos pases están bloqueados?, ¿cuáles esperan aprobación?, ¿dónde se atascan? Y quien no es técnico (líderes, directivos) no quiere leer tickets.

La 0.2.0 responde con un **tablero visual del flujo del pase**, que se mueve solo.

## Novedades frente a la 0.1.0

| Tema | Versión 0.1.0 | Versión 0.2.0 |
|---|---|---|
| Seguimiento del pase | Comentario y etiquetas en el ticket | **+ Tablero Kanban** en GitHub Projects con 5 columnas |
| Agente | Evalúa y comenta | **+ Mueve la tarjeta** a *Bloqueado* o *Listo para aprobaciones* |
| Respeto al trabajo humano | No aplica | El agente **no mueve** tarjetas que una persona ya avanzó a *Aprobado* o *En producción* |
| Quién entra al tablero | No aplica | Solo tickets del equipo (dueño, miembros, colaboradores) |
| Seguridad del token | No aplica | Token en un **entorno protegido** (`kanban`), limitado a la rama `main` |
| Guía interactiva | 8 pasos, diseño básico | **9 pasos**, iconos, colores, anillo de progreso, recorrido fijo y botón "Volver a la guía" |
| Portal | Sin sección de valor | **Pestaña Beneficios**: pilares, gráfico de riesgo en vivo, antes/después y criterios del reto |
| Producción | Hoja de ruta general | **Recomendación detallada de GitHub App** para bancos |
| Pruebas automáticas | 6 | **8** |

## Las 5 columnas del tablero
1. 📥 **Solicitado:** ticket recibido, sin evaluar.
2. 🚨 **Bloqueado:** el agente encontró bloqueos; hay que corregir.
3. ✅ **Listo para aprobaciones:** sin bloqueos; faltan las aprobaciones del nivel de riesgo.
4. 🔐 **Aprobado:** las aprobaciones están completas (lo mueve una persona).
5. 🚀 **En producción:** desplegado y cerrado (se completa al cerrar el ticket).

## Cómo funciona, paso a paso
1. El equipo abre un ticket `[Pase]` en GitHub.
2. El agente lo evalúa, comenta el informe y pone etiquetas de riesgo y estado.
3. **Nuevo:** un segundo trabajo del agente agrega la tarjeta al tablero y la coloca en *Bloqueado* o *Listo para aprobaciones*.
4. El equipo corrige y edita el ticket; el agente reevalúa y **la tarjeta cambia de columna sola**.
5. Las personas avanzan la tarjeta a *Aprobado* y, al cerrar el ticket, termina en *En producción*.

## Qué se probó y cómo
- ✅ **Prueba real en GitHub:** al reabrir el Issue #1, el agente evaluó el pase, los dos trabajos terminaron bien y la tarjeta apareció en **Listo para aprobaciones**.
- ✅ **Pruebas automáticas (8 de 8):** la elección de columna por estado y la regla de no mover tarjetas ya avanzadas por personas.
- ✅ CI, análisis de código (CodeQL) y publicación del portal en verde.
- ⏳ La prueba en vivo del movimiento hacia *Bloqueado* se hace con un ticket riesgoso nuevo; la elección de esa columna ya está cubierta por las pruebas automáticas.

## Seguridad
- El `GITHUB_TOKEN` de Actions no puede acceder a Projects, así que se usa un token con **solo** el permiso `project`.
- Vive como secreto de un **entorno** (`kanban`), no del repositorio, y ese entorno solo funciona desde `main`.
- El token se recibe solo por variable de entorno y **nunca se imprime**.
- El texto del ticket se trata solo como dato.
- Para producción se recomienda una **GitHub App**: tokens que expiran en 1 hora, permisos granulares, identidad propia del proceso, auditoría y gobierno central (detalle y pasos en el [documento 06](06-tablero-kanban-y-github-app.md)).

## Qué impacto busca
- ⏱️ **Productividad:** menos preguntas de "¿cómo va mi pase?"; el estado se ve de un vistazo.
- 🛡️ **Menos riesgo:** los pases bloqueados no avanzan y se ven desde el primer momento.
- 👔 **Visibilidad para liderazgo:** un tablero y una guía visual, sin leer tickets técnicos.
- 🔁 **Reutilización:** otras tribus copian el tablero y cambian su carpeta `knowledge/`.
- 📅 **Plazo realista:** pasar de token personal a GitHub App es trabajo de aproximadamente un día.

## Qué es POC y qué falta
- Datos simulados; sin conexión al Kanban corporativo ni a la gestión real de incidentes.
- Token personal de corta duración para la POC; en producción, GitHub App y tablero de organización.
- El avance a *Aprobado* es manual; conectarlo con las aprobaciones reales es el siguiente paso.

## Dónde probarlo
- Portal: https://hybridcloudcompany.github.io/Grupo11/ (empieza por **Guía paso a paso**).
- Repositorio: https://github.com/hybridcloudcompany/Grupo11
