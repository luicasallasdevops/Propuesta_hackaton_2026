# OCD: pase a producción con calendario y aprobadores

> Contenido SIMULADO para la POC. Reemplazar por el procedimiento oficial de Change Management.

## Qué es un OCD
- OCD es el ticket de pase a producción que se calendariza. Reúne el cambio, sus evidencias, los aprobadores y la noche exacta de ejecución.
- Tiene tres tipos: Estándar (repetible y de bajo riesgo), Normal (planificado, pasa por el CAB) y Emergencia (corrige un incidente activo).
- Se crea en Jira (en esta POC se simula en la pestaña Pase OCD). El agente lo revisa al instante y te dice qué falta.

## Quiero que me ayuden a crear el OCD
- Escribe «quiero crear un OCD» en el chat. El asistente te pide tu matrícula (formato M-12345) y valida tus grupos de red de DevSecOps.
- Si te faltan grupos, te pregunta si quieres que cree la solicitud en Helpdesk (cola Accesos y redes) y te muestra el ticket.
- Después te pide tu historia (formato HU-1234). Si no la conoces, te ayuda a crearla con tres preguntas: quién se beneficia, qué quiere y para qué.
- Luego te pide los datos del OCD: tipo, criticidad, tamaño, fecha, hora, rollback, evidencias y descripción. No te pide las instrucciones todavía. Asocia la historia al OCD.
- Te guía paso a paso por la gestión del OCD con el calendario. En la revisión del líder técnico valida tus instrucciones de despliegue.
- En el OCD real, el agente repite las verificaciones con la matrícula, la historia y las instrucciones del formulario y bloquea el OCD si algo falla.

## Instrucciones de despliegue del OCD
- Se entregan en las revisiones técnicas, no al crear el OCD.
- Deben tener al menos 3 pasos numerados, un paso de rollback y una verificación posterior (30 minutos).
- No deben incluir contraseñas, tokens ni llaves. Usa el gestor de secretos.
- El agente bloquea comandos peligrosos como rm -rf, DROP TABLE, TRUNCATE, chmod 777 o curl | sh.
- Si el servicio es de criticidad Alta, añade un paso previo de respaldo o precondiciones.
- Si no sabes cómo escribirlas, pide la plantilla al asistente y ajústala a tu cambio.

## Historia asociada al OCD
- Todo OCD se asocia a una historia (HU-1234) del mismo servicio. El agente bloquea el OCD si falta, no existe o es de otro servicio.
- Si no tienes historia, el asistente te ayuda a crearla: rol, objetivo y beneficio, con criterios de aceptación estándar.

## Cómo crear un OCD en Jira paso a paso
1. Verifica que tienes los grupos de red de DevSecOps y los del servicio. Si falta alguno, pídelo en Helpdesk antes de abrir el OCD.
2. Reúne las evidencias: pruebas QA, SAST, SCA, escaneo de secretos, runbook y monitoreo.
3. Define el rollback y pruébalo en un ambiente previo. Sin rollback el OCD se bloquea.
4. En Jira elige el proyecto OCD y el tipo de incidencia Pase a Producción.
5. Asocia tu historia (HU-1234). Completa tu matrícula, servicio, tipo de cambio, criticidad, tamaño, fecha y hora. La fecha es una noche de martes a jueves entre las 22:00 y las 04:00.
6. Elige a los aprobadores del servicio: líder técnico, Product Owner, Seguridad y Change Management.
7. Crea el ticket. El agente publica el informe con bloqueos, calendario y aprobadores, y mueve el estado.
8. Corrige lo que el agente marque y edita el ticket. El informe se actualiza solo.

## Grupos de red para un OCD
- Para crear y ejecutar cualquier OCD necesitas los grupos de red de DevSecOps: GR-DSO-GITHUB (GitHub y repositorios), GR-DSO-SCAN (resultados de SAST, SCA y secretos) y GR-DSO-RELEASE (ambientes protegidos de release).
- Si no los tienes, el asistente te ofrece crear la solicitud en Helpdesk por ti. La aprobación es de tu líder técnico y tarda 3 días hábiles.
- Cada servicio exige grupos de red en producción: acceso a servidores de aplicación (GR-APP), acceso de lectura a la base de datos (GR-DB) y la red del runner de despliegue (GR-DEPLOY).
- No todos los servicios necesitan los tres. El asistente te muestra cuáles exige tu servicio y cuáles ya tienes.
- Si te falta un grupo, crea una Solicitud de red en Helpdesk (cola Accesos y redes), indica el servicio y el grupo, y pide la aprobación de tu líder técnico.
- La solicitud de red tarda 3 días hábiles. Pídela antes de abrir el OCD: pedirla el mismo día retrasa el pase.

## Quién es quién en un OCD
- Líder técnico: confirma que el cambio es correcto y que el equipo puede ejecutarlo y revertirlo.
- Product Owner: confirma que el cambio aporta valor y que el momento de salida es aceptable para el negocio.
- Seguridad: revisa SAST, SCA, secretos y accesos. En un OCD Normal aprueba antes de la sesión del CAB.
- Change Management: aprueba en el CAB y valida calendario, cupo y congelamientos.
- Delegado CIO: se suma cuando el riesgo es Crítico o cuando se ejecuta dentro de un congelamiento.
- En un OCD de Emergencia el Product Owner solo es informado, y Seguridad y Change Management aprueban a posteriori en máximo 24 horas.
- Cada servicio tiene sus propios responsables. El simulador de Jira te dice quién es cada uno.

## Reglas del calendario
- Ventana estándar: martes a jueves, de 22:00 a 04:00. La fecha del OCD es la noche en que empieza la ventana.
- Cupo: máximo 3 OCD por noche. Si la noche está llena, el agente propone la primera noche libre.
- Anticipación Normal: entre 5 y 7 días hábiles, según la sesión del CAB. El CAB sesiona martes y jueves a las 10:00.
- Anticipación Estándar: 2 días hábiles. Si el riesgo sale Alto o Crítico, se trata como Normal.
- Los fines de semana, los feriados y los congelamientos no admiten OCD, salvo Emergencia.
- Los congelamientos simulados son el evento comercial de fin de mes y el cierre de año.

## Cómo calcula el agente las fechas
1. Parte de la noche de ejecución y calcula hacia atrás, en días hábiles.
2. Confirmar ventana y avisar a las áreas: 1 día hábil antes.
3. CAB: la última sesión (martes o jueves) que ocurra 2 días hábiles antes o antes.
4. Seguridad: el día hábil anterior al CAB. Líder técnico: el día hábil anterior a Seguridad.
5. Crear el OCD: el día hábil anterior a la revisión del líder técnico.
6. Si esa fecha de creación ya pasó, el OCD se bloquea por anticipación insuficiente y el agente propone otra noche.

## Cómo ejecutar el pase el día del OCD
1. Confirma que el ticket está en la columna Aprobado del tablero.
2. Avisa al canal de operaciones que inicia la ventana.
3. Lanza el workflow de ejecución del OCD con el número del ticket. El ambiente production pide aprobación.
4. Despliega y valida el servicio con las pruebas de humo del runbook.
5. Verifica 30 minutos las métricas y las alertas. Si algo falla, ejecuta el rollback probado.
6. Cierra el OCD con la evidencia: resultado de la verificación y hora de finalización.

## Errores frecuentes en un OCD
- Elegir viernes o fin de semana: queda fuera de la ventana.
- Elegir una noche que ya tiene 3 OCD.
- Crear el OCD con menos días de anticipación de los que pide el CAB.
- No avisar a las áreas impactadas antes de la ventana.
- Pedir los grupos de red el mismo día de la ejecución.
- Crear el OCD sin historia o con la historia de otro servicio.
- Escribir instrucciones sin rollback o con una contraseña en el texto.
