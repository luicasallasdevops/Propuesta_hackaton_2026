# Guía para equipos

## Para desarrolladores
1. Abre el portal y pregunta lo que necesites (pase, roles, red, licencias, herramientas).
2. Antes de pedir el pase, usa **Validar mi pase** para ver bloqueos y acciones.
3. Abre el Issue **Pase a Producción** con el formulario. El agente responde solo.
4. Corrige y edita el Issue hasta que el estado sea *Listo para aprobaciones*.
5. Copia las plantillas de `templates/` a tu repositorio sin cambiar permisos ni umbrales.

## Para SecOps y plataforma (mantener el conocimiento)
- **Cambiar un estándar:** edita `knowledge/0X-*.md` con un pull request. Cada sección se titula con `##`.
- **Ajustar el riesgo:** edita `knowledge/policy.json` (pesos, bloqueos, aprobaciones).
- **Registrar un incidente:** agrega un objeto a `knowledge/incidents.json` con `id`, `fecha`, `servicio`, `severidad`, `dia`, `causa`, `resumen` y `accion`. Si la causa es nueva, agrega su recomendación en `policy.json` y su condición en `engine.mjs`.
- **Agregar una plantilla:** súbela a `templates/workflows/`. Aparece sola en el portal.
- Cada cambio pasa por CI (pruebas) y se publica automáticamente.

## Para otras tribus
1. Haz un fork o usa el repositorio como plantilla.
2. Reemplaza `knowledge/` por los estándares de tu tribu.
3. Ajusta `policy.json` a tus servicios y criticidades.
4. Activa Pages y las Issue Forms. No hay infraestructura que montar.

## Activación del repositorio (una vez)
1. Settings → Pages → Source: **GitHub Actions**.
2. Recomendado: protección de rama en `main`, Push Protection y alertas de Dependabot.

## Probar localmente
```
npm test
npm run build
python3 -m http.server -d docs 8080   # abrir http://localhost:8080
```

## Preguntas frecuentes
- **¿El portal envía mis datos a algún lado?** No. Corre en el navegador.
- **¿Por qué el agente me bloquea?** El informe lista el bloqueo exacto y qué corregir.
- **¿Quién decide el pase?** Las aprobaciones humanas indicadas. El agente solo prepara y valida.
