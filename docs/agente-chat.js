// Agente conversacional: entiende frases libres, conserva el contexto, pregunta solo lo que falta y muestra qué hizo.
// Solo reglas deterministas y nodos DOM (sin innerHTML). Riesgo, calendario y aprobaciones los valida el motor.
import { quitarAcentos, intencion, extraerDatos, mezclar, faltantes, respuestaACampo, evaluarCambio, precargaOcd, resumenCambio, nombreDia } from "./conversacion.mjs";
import { fmtFechaCorta, proximaVentana } from "./engine.mjs";

export function crearAgenteChat({ say, el, dir, cfg, cal, policy, incidents, asistenteOcd, preguntar, ocdIssueUrl }) {
  const HOY = cfg.fechaDemo;
  const servicios = Object.keys(dir.servicios);
  const ejemplo = "Necesito desplegar pagos-api este viernes y todavía no tengo rollback";
  let estado = { cambio: { faltan: [] }, pregunta: null, evaluado: false };

  const p = (t) => el("p", { textContent: t });
  const lista = (items, tag = "ul") => el(tag, {}, items.map((t) => el("li", { textContent: t })));
  const boton = (etiqueta, accion) => el("button", { type: "button", className: "qr", textContent: etiqueta, onclick: () => { say("user", etiqueta); accion(); } });
  const directo = (etiqueta, accion) => el("button", { type: "button", className: "qr", textContent: etiqueta, onclick: accion });
  const botones = (...b) => el("div", { className: "qrs" }, b.flat().filter(Boolean));

  /* ---------- Saludo y menú ---------- */
  const saludoHora = () => { const h = new Date().getHours(); return h < 12 ? "¡Buenos días!" : h < 19 ? "¡Buenas tardes!" : "¡Buenas noches!"; };

  function tarjeta(icono, titulo, sub, accion) {
    return el("button", { type: "button", className: "menu-card", onclick: () => { say("user", titulo); accion(); } },
      el("span", { className: "mc-i", textContent: icono, ariaHidden: "true" }), el("span", { className: "mc-t" }, el("strong", { textContent: titulo }), el("small", { textContent: sub })));
  }

  function menuNodo() {
    return el("div", { className: "menu-grid" },
      tarjeta("📅", "Crear mi OCD paso a paso", "Con validaciones y feedback en cada paso", () => asistenteOcd.iniciarConDatos(precargaOcd(estado.cambio))),
      tarjeta("🚀", "Validar mi pase a producción", "Cuéntame qué vas a desplegar y lo reviso", pedirCambio),
      tarjeta("🧭", "Conocer cómo funciona el OCD", "Estados, modalidades y quién mueve cada uno", () => asistenteOcd.explicarFlujo()),
      tarjeta("👥", "¿Qué me toca según mi rol?", "Tus pendientes y el comando para avanzar", () => asistenteOcd.preguntarRol()),
      tarjeta("🔐", "Roles, red y licencias", "Qué necesito pedir y cómo", ayudaAccesos),
      tarjeta("📦", "Plantillas de seguridad", "Workflows y configuraciones listos para copiar", ayudaPlantillas));
  }

  function menu(intro) {
    say("bot", p(intro ?? "¿Qué quieres hacer hoy? Elige una opción o escríbeme con tus palabras."), menuNodo(),
      el("p", { className: "muted small", textContent: `Por ejemplo: «${ejemplo}»` }));
  }

  function saludar() {
    say("bot", p(`${saludoHora()} Soy tu asistente DevSecOps. Te acompaño de punta a punta: desde preparar tu OCD hasta que el pase salga bien en producción.`),
      p("¿Qué quieres hacer hoy?"), menuNodo(),
      botones(directo("Probar con un ejemplo", () => preguntar(ejemplo))));
  }

  function ayudaAccesos() {
    say("bot", p("Claro. ¿Qué necesitas saber?"), botones(
      ["¿Qué rol necesito y cómo lo pido?", "¿Qué grupos de red necesito?", "¿Qué licencias necesito?", "¿Cómo creo un ticket de pase a producción?"].map((t) => directo(t, () => preguntar(t)))));
  }
  function ayudaPlantillas() {
    say("bot", p("Tengo plantillas oficiales con permisos mínimos. ¿Cuál te sirve?"), botones(
      [["Análisis de seguridad (CodeQL)", "Dame un workflow de CodeQL"], ["Publicación protegida a producción", "Dame un workflow de release a producción"], ["Actualizaciones automáticas (Dependabot)", "Dame la configuración de Dependabot"]].map(([e, t]) => directo(e, () => preguntar(t)))));
  }

  /* ---------- Validar un pase conversando ---------- */
  function pedirCambio() {
    estado.pregunta = null;
    say("bot", p("Cuéntame con tus palabras qué quieres desplegar: el servicio, el día y cómo está tu plan de reversa. Yo te digo qué falta, qué riesgo tiene y qué fecha sirve."),
      botones(directo("Probar con un ejemplo", () => preguntar(ejemplo))));
  }

  function pedir(campo) {
    estado.pregunta = campo;
    const res = resumenCambio(estado.cambio);
    const intro = res ? `Voy entendiendo: ${res}. ` : "";
    if (campo === "servicio") say("bot", p(`${intro}¿Qué servicio vas a desplegar?`), botones(servicios.map((s) => boton(s, () => aplicar({ servicio: s })))));
    else if (campo === "fecha") {
      const sug = proximaVentana("Normal", HOY, cfg, cal);
      say("bot", p(`${intro}¿Para qué día lo quieres? Puedes decirme «el martes», «mañana» o una fecha.`),
        botones(sug ? boton(`La próxima noche disponible (${nombreDia(sug).toLowerCase()} ${fmtFechaCorta(sug)})`, () => aplicar({ fecha: sug })) : null));
    } else if (campo === "rollback") say("bot", p(`${intro}¿Tienes plan de rollback (volver atrás si algo falla)?`),
      botones(boton("Sí, probado", () => aplicar({ rollback: "Sí, probado" })), boton("Sí, pero sin probar", () => aplicar({ rollback: "Sí, sin probar" })), boton("No, todavía no", () => aplicar({ rollback: "No" }))));
  }

  /** Une datos nuevos al contexto y avanza: pregunta lo que falta o evalúa. */
  function aplicar(datos) {
    const antes = estado.cambio;
    const { cambio, cambios } = mezclar(antes, datos);
    estado.cambio = cambio; estado.pregunta = null;
    const falta = faltantes(cambio);
    if (falta.length) { pedir(falta[0]); return; }
    mostrarEvaluacion(cambios, antes);
  }

  function mostrarEvaluacion(cambios, antes) {
    const c = estado.cambio;
    const e = evaluarCambio(c, { policy, cfg, cal, incidents, hoy: HOY });
    estado.evaluado = true; estado.ultima = e;
    const color = e.r.estado === "Bloqueado" ? "bad" : e.r.score < 30 ? "ok" : "warn";
    const nota = [];
    const f = cambios.find((x) => x.campo === "fecha" && x.de);
    if (f) nota.push(`Cambié la fecha de ${nombreDia(f.de).toLowerCase()} ${f.de} a ${nombreDia(f.a).toLowerCase()} ${f.a} y volví a evaluar.`);
    for (const x of cambios.filter((y) => y.campo !== "fecha" && y.de)) nota.push(`Actualicé ${x.campo}: ${x.de} → ${x.a}.`);
    for (const x of cambios.filter((y) => y.campo === "faltan")) nota.push(`Anoté que te falta ${x.a.toUpperCase()}.`);
    const traza = el("details", { className: "traza" },
      el("summary", { textContent: "🔎 Qué hizo el agente (consultó · detectó · propone · hizo)" }),
      el("h4", { textContent: "Consultó" }), lista(e.traza.consulto),
      el("h4", { textContent: "Detectó" }), e.traza.detecto.length ? lista(e.traza.detecto) : p("Nada que bloquee."),
      el("h4", { textContent: "Propone" }), e.traza.propone.length ? lista(e.traza.propone, "ol") : p("Seguir con las aprobaciones."),
      el("h4", { textContent: "Hizo" }), p(e.traza.accion),
      el("h4", { textContent: "Evidencia" }), p(e.traza.evidencia),
      el("pre", {}, el("code", { textContent: JSON.stringify({ ...e.change, checks: undefined, fecha: c.fecha, hora: e.hora, faltan: c.faltan }, null, 1) })));
    const calendario = e.r.blockers.some((b) => /ventana|feriado|congelamiento|cupo|Anticipación|futura/i.test(b));
    const acciones = [];
    if (e.fechaSugerida && calendario && e.fechaSugerida !== c.fecha) acciones.push(boton(`Usar ${e.sugeridaTxt}`, () => aplicar({ fecha: e.fechaSugerida })));
    if (c.rollback === "No") acciones.push(boton("Ya tengo el rollback probado", () => aplicar({ rollback: "Sí, probado" })));
    acciones.push(boton("Preparar mi OCD con estos datos", () => asistenteOcd.iniciarConDatos(precargaOcd(estado.cambio, calendario ? e.fechaSugerida : null))));
    say("bot",
      nota.length ? el("p", { className: "muted", textContent: nota.join(" ") }) : "",
      el("h3", { textContent: `${c.servicio} · ${nombreDia(c.fecha).toLowerCase()} ${c.fecha}` }),
      el("div", { className: "score" }, el("span", { className: `pill ${color}`, textContent: e.r.estado }),
        el("div", { className: "meter", role: "img", ariaLabel: `Riesgo ${e.r.score} de 100` }, Object.assign(el("i"), { style: `width:${e.r.score}%;background:var(--${color})` })),
        el("strong", { textContent: `${e.r.nivel} · ${e.r.score}/100` })),
      e.r.blockers.length ? el("div", {}, p("Esto es lo que impide que pase hoy:"), lista(e.r.blockers)) : p("✅ Cumple lo necesario para pedir aprobaciones."),
      e.r.actions.length ? el("div", {}, p("Lo que te propongo:"), lista(e.r.actions, "ol")) : "",
      e.r.advertencias.length ? lista(e.r.advertencias.map((a) => `⚠️ ${a}`)) : "",
      el("p", { className: "muted small", textContent: `Supuse: ${e.supuestos.join(", ")}.` }),
      traza,
      botones(acciones, el("a", { className: "qr", href: ocdIssueUrl({ servicio: c.servicio, fecha: calendario && e.fechaSugerida ? e.fechaSugerida : c.fecha, hora: e.hora }), textContent: "Crear el OCD en GitHub ↗", target: "_blank", rel: "noopener" })),
      el("p", { className: "muted small", textContent: "Puedes seguir cambiando datos con tus palabras, por ejemplo: «mejor el martes», «ya probé el rollback» o «es un cambio grande»." }));
  }

  /* ---------- Entrada de texto ---------- */
  function manejar(texto) {
    const t = String(texto ?? "").trim();
    const q = quitarAcentos(t);
    const it = intencion(t);
    const datos = extraerDatos(t, { servicios, hoy: HOY });
    const hayDatos = Object.keys(datos).length > 0;

    if (it === "saludo") { saludar(); return true; }
    if (it === "gracias") { say("bot", p("¡Con gusto! Estoy aquí para lo que necesites. ¿Quieres hacer algo más?"), botones(boton("Ver opciones", () => menu()), boton("Crear mi OCD", () => asistenteOcd.iniciarConDatos(precargaOcd(estado.cambio))))); return true; }
    if (it === "adios") { say("bot", p("¡Hasta pronto! Cuando quieras retomar, aquí estaré.")); return true; }
    if (it === "menu") { menu(); return true; }

    if (estado.pregunta) {
      const r = { ...respuestaACampo(estado.pregunta, t), ...datos };
      if (Object.keys(r).length) { aplicar(r); return true; }
      if (estado.pregunta === "servicio" && !/[?¿]/.test(t)) { say("bot", p(`No reconozco ese servicio. Elige uno: ${servicios.join(", ")}.`)); return true; }
    }
    if (/\bocd\b/.test(q) && /(crear|crea|creo|armar|abrir|generar|preparar|ayud)/.test(q) && !/[?¿]/.test(t)) {
      asistenteOcd.iniciarConDatos(precargaOcd(mezclar(estado.cambio, datos).cambio)); return true;
    }
    const quiere = /(necesito|quiero|voy a|debo|tengo que)\s+(desplegar|pasar|subir|publicar|llevar|salir)/.test(q) || /(validar|revisar|chequear|evaluar|analizar)\s+(mi|el|este)?\s*(pase|despliegue|cambio)/.test(q);
    if ((it === "evaluar" && hayDatos) || quiere || (estado.evaluado && hayDatos)) { aplicar(datos); return true; }
    return false;
  }

  function reiniciarContexto() { estado = { cambio: { faltan: [] }, pregunta: null, evaluado: false }; }

  return { manejar, saludar, menu, pedirCambio, reiniciarContexto, ayudaAccesos, ayudaPlantillas, get contexto() { return estado; } };
}
