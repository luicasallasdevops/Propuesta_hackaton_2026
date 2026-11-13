# Análisis de funcionalidad y seguridad (versión 1.0.0 de la POC)

Fecha del análisis: 2026-11-13. Alcance: portal, agente, tablero, workflows y configuración del repositorio. Todo el contenido es **simulado**.

## Veredicto
**Estable para una POC y listo para demostrar.** No encontré fallas funcionales. Los hallazgos de seguridad eran de endurecimiento, no de explotación: los corregí o los dejé documentados con su recomendación para producción.

## 1. Funcionalidad

| Capacidad | Cómo se probó | Resultado |
|---|---|---|
| Chat con estándares y fuente | Portal en vivo | ✅ |
| Validador de pase | Caso riesgoso y camino feliz en el portal | ✅ Crítico 100/100 y Medio (baja con el tiempo) |
| Agente en Issues | Issue #1 (feliz) e Issue #2 (bloqueado) | ✅ Comentario, etiquetas y actualización del mismo comentario |
| Tarjeta en el tablero | Issue #1 → *Listo para aprobaciones*; Issue #2 → *Bloqueado* | ✅ Ambas en su columna |
| Regla "no mover lo avanzado por personas" | Pruebas automáticas | ✅ |
| Guía interactiva (9 pasos) | Portal en vivo | ✅ Progreso, recorrido y enlaces |
| Pestaña Beneficios | Portal en vivo | ✅ Gráfico con el motor real |
| CI, CodeQL, publicación del portal | GitHub Actions | ✅ En verde |
| Pruebas automáticas | `npm test` | ✅ 8 de 8 |
| Releases | v0.1.0-poc y v0.2.0-poc | ✅ |

**Aún sin demostrar en vivo:** que la tarjeta del Issue #2 pase de *Bloqueado* a *Listo* al corregirlo. La lógica está cubierta por pruebas y es el minuto 4:30 del guion de la demo.

### Límites funcionales conocidos
- GitHub no precarga los desplegables del formulario por URL; la guía muestra los datos del caso para elegirlos a mano.
- El riesgo del camino feliz depende de la fecha (ventana de 90 días de incidentes): hoy es Medio y bajará.
- Los datos son simulados y no hay conexión con el Kanban ni la gestión de incidentes reales.
- El agente es determinista (sin IA generativa): es explicable y reproducible; un resumen con IA es una mejora futura.
- El estado en vivo de la guía usa la API pública de GitHub sin token (límite de consultas por hora).

## 2. Seguridad

### Revisión del código
- Sin `innerHTML`, `eval` ni `document.write`; el portal construye todo con nodos DOM y `textContent`.
- CSP estricta: `default-src 'none'`, scripts y estilos solo propios, sin CDN.
- Sin dependencias de ejecución (`package.json` no tiene dependencias).
- Sin secretos ni archivos sensibles en el repositorio.
- Los datos de los tickets nunca se interpolan en comandos; las menciones y el HTML se neutralizan en los comentarios.

### Hallazgos y estado

| # | Hallazgo | Riesgo | Estado |
|---|---|---|---|
| 1 | Acciones fijadas por etiqueta (`@v7`), no por commit | Medio (cadena de suministro) | ✅ **Corregido:** todas fijadas por SHA con su versión en un comentario; Dependabot las actualiza |
| 2 | Dependency graph, alertas de Dependabot, escaneo de secretos, bloqueo de pushes con secretos y reporte privado de vulnerabilidades apagados | Medio | ✅ **Activados** |
| 3 | Workflows de colaboradores externos: solo aprobación a primeros contribuyentes | Bajo | ✅ **Cambiado** a aprobación para todos los externos |
| 4 | Se permiten acciones de cualquier autor | Bajo | ✅ **Corregido:** solo acciones creadas por GitHub y requisito de SHA completo; CI relanzado y en verde |
| 5 | Token personal con permiso `project` (amplio y de larga duración) | Medio | ⚠️ Aceptado en la POC con mitigaciones (entorno `kanban`, solo `main`, caducidad corta). **Producción: GitHub App** ([documento 06](06-tablero-kanban-y-github-app.md)) |
| 6 | Sin ruleset en `main` (cualquiera con permiso de escritura puede empujar o forzar) | Bajo en POC | ⏳ Producción: PR obligatorio, revisión, checks requeridos y bloqueo de force push |
| 7 | Repositorio público: cualquiera puede abrir un ticket `[Pase]` | Bajo | ✅ El agente solo comenta; al tablero entran solo OWNER, MEMBER y COLLABORATOR |

### Lo que ya estaba bien
- Permisos del `GITHUB_TOKEN` por defecto en solo lectura y mínimos por trabajo.
- `persist-credentials: false` y concurrencia por ticket.
- Token del tablero en un entorno restringido a `main`, nunca impreso.
- CodeQL en cada cambio y Copilot Autofix activo.

## 3. Recomendaciones para llevarlo a producción
0. Fijar la imagen del ejecutor (hoy `ubuntu-latest`): GitHub avisa que la etiqueta migrará a Ubuntu 26. Conviene una versión explícita y validada para que los resultados no cambien solos.
1. Migrar el tablero a una organización y usar **GitHub App** (tokens de 1 hora, permisos granulares, auditoría).
2. Ruleset en `main` con revisiones obligatorias y checks requeridos.
3. Revisores requeridos en el entorno `kanban` si se quiere aprobación humana antes de mover tarjetas.
4. Conectar el Kanban y la gestión de incidentes reales por API; alimentar `incidents.json` automáticamente.
5. Definir quién mantiene `policy.json` y los estándares (cambios por pull request).
6. Medir el antes y después: tiempo de pase, rechazos e incidentes evitados.

## 4. Mapa a los criterios del reto
- **IA agéntica:** el agente actúa ante eventos y mueve tarjetas.
- **Prototipo y UX:** portal con guía visual de 9 pasos, Beneficios y tablero público.
- **Impacto:** menos rechazos y visibilidad para liderazgo (objetivo, a medir con datos reales).
- **Innovación:** conocimiento, historial de incidentes, agente y Kanban en un solo flujo.
- **Factibilidad y escalabilidad:** solo GitHub; otras áreas cambian su carpeta `knowledge/`.
