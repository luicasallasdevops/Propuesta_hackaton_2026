# Asistente conversacional (versión 1.4.0)

El chat es la puerta de entrada del portal. Entiende frases libres, conserva el contexto, pregunta solo lo que falta y deja ver qué hizo.

## Qué puede hacer el usuario
- Saludar o escribir «menú»: el asistente responde con cordialidad y ofrece opciones.
- Contar su caso con sus palabras: «Necesito desplegar pagos-api este viernes y todavía no tengo rollback».
- Crear su OCD paso a paso, con validaciones, sin repetir lo que ya contó.
- Cambiar un dato en cualquier momento («mejor el martes», «ya probé el rollback») sin reiniciar.
- Hacer una pregunta intermedia y retomar el OCD donde iba.

## Cómo entiende (sin LLM)
`scripts/conversacion.mjs` es una capa de reglas puras y probadas: extrae intención y datos (servicio, fecha relativa o numérica, rollback, criticidad, tipo, controles que faltan), los mezcla con el contexto y calcula qué falta. Luego llama al **mismo motor** del agente (`assessOcd`), así el riesgo, el calendario, el cupo y las aprobaciones se validan igual en el chat, en el portal y en GitHub Actions.

## Traza de lo que hizo el agente
Cada evaluación incluye un bloque desplegable con: qué **consultó** (política, calendario, historial), qué **detectó**, qué **propone**, qué **hizo** y la **evidencia** (las entradas usadas, reproducibles). Lo que el usuario no dijo se declara como supuesto.

## Entorno de demostración
Un único aviso visible explica qué es real (Issues, Actions, etiquetas, comandos `/ocd`, tablero) y qué es demostrativo (Jira, Helpdesk, directorio de personas, calendario e incidentes de ejemplo).

## Siguiente fase: modelo de lenguaje opcional
Un LLM podría interpretar mejor frases largas o ambiguas y redactar respuestas, pero solo para **entender y explicar**. Las reglas de seguridad, los permisos y las aprobaciones seguirían en el motor. Requiere una clave de un proveedor (o el Copilot de la entidad) y una decisión sobre qué datos pueden salir del repositorio.

## Dónde está el código
| Archivo | Función |
|---|---|
| `scripts/conversacion.mjs` | Intención, datos, contexto y evaluación con traza |
| `docs/agente-chat.js` | Saludo, menú, evaluación en el chat y traza |
| `docs/ocd-assistant.js` | Guía del OCD, pausa y retoma, cambios a mitad |
| `tests/conversacion.test.mjs` | Pruebas del lenguaje y del caso del viernes sin rollback |

## Progreso por fases (1.6.2)
Durante la guía del OCD el portal muestra dos fases: **Requisitos** (matrícula, grupos de red, historia, modalidad, datos) y **OCD** (los 8 estados principales). Al completar los requisitos se marcan en verde y se colapsan; se pueden reabrir. Las respuestas del chat aparecen siempre debajo del panel.

## Historia en Jira (1.6.1)
«No tengo historia» arma el «Como… quiero… para…» y abre el formulario `historia.yml` prellenado. El workflow `historia-jira` crea la Historia en KAN y responde con la clave (KAN-n), que se escribe en el chat. Ver documento 17.
