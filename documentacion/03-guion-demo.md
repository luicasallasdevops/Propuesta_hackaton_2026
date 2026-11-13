# Guion de la demo (6 minutos)

**Preparación (5 min antes):** portal abierto en la pestaña *Guía paso a paso*, el [tablero](https://github.com/users/luicasallasdevops/projects/1) abierto en otra pestaña y los Issues #1 (listo) y #2 (bloqueado) como respaldo.

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0:00 | Pestaña **Beneficios** (pilares y gráfico) | "El reto es anticiparse a los problemas. Hoy se descubren tarde: con pases rechazados o fallos en producción." |
| 0:45 | **Preguntar**: "¿Cómo creo un ticket de pase?" | "Responde con el estándar oficial y cita la fuente." |
| 1:30 | **Guía**, paso 2 (caso riesgoso) | "Pagos, viernes, sin rollback: Bloqueado, Crítico 100 de 100, con los incidentes pasados que lo respaldan." |
| 2:15 | **Guía**, paso 3 (camino feliz) | "Mismo servicio bien preparado: Listo para aprobaciones. Solo piden las aprobaciones de su nivel." |
| 3:00 | **Issue #2** (bloqueado): comentario y etiquetas | "Esto lo hizo el agente solo, en GitHub Actions, al abrir el ticket." |
| 3:45 | **Tablero**: tarjeta #2 en Bloqueado y #1 en Listo | "El agente también mueve la tarjeta. Liderazgo ve el estado sin leer tickets." |
| 4:30 | Editar el Issue #2 (martes, rollback probado, casillas) y refrescar el tablero | "Al corregir, el informe se actualiza y la tarjeta cambia de columna sola." |
| 5:15 | **Cómo funciona** y documento 06 | "Todo sobre GitHub, con permisos mínimos. Para producción: GitHub App, tokens de 1 hora y auditoría." |
| 5:45 | Cierre | Impacto, reutilización entre tribus y plan de 6 meses. |

## Extra: pase OCD (3 minutos, opcional)
| Qué mostrar | Qué decir |
|---|---|
| **Simulador de Jira**: perfil Valentina, pulsar Crear | "Una persona nueva no sabe qué grupos de red ni qué aprobadores necesita. El asistente se lo dice antes de que el pase se retrase." |
| Cambiar a Mateo, Autocompletar, Crear y simular aprobaciones | "Con todo en orden el ticket avanza hasta producción." |
| Pestaña **📅 Pase OCD**, caso "🈵 Noche llena" | "El OCD es el pase que se agenda. El agente ve que la noche del miércoles ya tiene 3 cambios y propone el jueves." |
| Caso "✅ OCD listo" y el calendario | "Calcula hacia atrás qué día revisa el líder, qué día Seguridad, el CAB y cuándo se avisa a las áreas." |
| **Simulador**, escenario "OCD bloqueado que se corrige" | "La tarjeta pasa por el tablero: bloqueado, corregido, aprobado, en producción." |

## Plan B
- Si Actions tarda, mostrar los Issues #1 y #2, que ya están evaluados.
- Si el portal no carga, ejecutar localmente `npm run build && python3 -m http.server -d docs 8080`.
- Si el tablero no responde, mostrar la captura del documento 08.

## Valores del caso bloqueado
Servicio `pagos-api` · Tipo Normal · Criticidad Alta · Tamaño Grande · Día Viernes · Rollback No · sin casillas marcadas.
Caso feliz: Tamaño Pequeño · Día Martes · Rollback "Sí, probado" · las 9 casillas.
Nota: el riesgo del camino feliz (hoy Medio) baja con el tiempo; no cites un número fijo.
