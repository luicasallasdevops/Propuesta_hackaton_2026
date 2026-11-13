# Guion de la demo (5 minutos)

**Preparación:** repo público, Pages activo, un Issue de ejemplo cerrado como respaldo.

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0:00 | Diapositiva del problema | "Hoy preparar un pase toma semanas porque la información está dispersa." |
| 0:30 | Portal, pestaña Preguntar: "¿Cómo creo un ticket de pase?" | "Responde con el estándar y cita la fuente." |
| 1:15 | "Dame un workflow de CodeQL" y botón Copiar | "Plantilla oficial de SecOps con permisos mínimos." |
| 2:00 | Validar mi pase con los valores por defecto (viernes, sin rollback, pagos-api) | "Bloqueado y crítico. Ve por qué y qué hacer, con los incidentes que lo respaldan." |
| 3:00 | Abrir Issue con el formulario, mismos datos | "En segundos el agente comenta, etiqueta y lista las aprobaciones." |
| 3:45 | Editar el Issue: martes, rollback probado, controles marcados | "El informe se actualiza a Listo para aprobaciones." |
| 4:30 | Pestaña Cómo funciona y arquitectura | "Todo sobre GitHub. Otras tribus solo cambian los documentos." |
| 5:00 | Cierre | Impacto, reutilización y hoja de ruta de 6 meses. |

## Plan B
- Si Actions tarda, mostrar el Issue de ejemplo ya evaluado.
- Si el portal no carga, ejecutar localmente `npm run build && python3 -m http.server -d docs 8080`.
