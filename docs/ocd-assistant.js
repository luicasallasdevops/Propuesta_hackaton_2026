// Asistente conversacional del OCD (todo simulado, sin IA generativa, solo nodos DOM).
// Escenario 1: el usuario pregunta cómo crear un OCD -> el agente valida sus grupos de red de DevSecOps y, si faltan, ofrece pedirlos en Helpdesk.
// Escenario 2: el usuario pide crear un OCD -> historia (validar o crear), datos del OCD, guía interactiva y validación de instrucciones en las revisiones técnicas.
import {
  assessOcd, buscarPorMatricula, normalizarMatricula, validarEquipoOcd, proximaVentana, fechaValida, fmtFechaCorta,
  revisarGruposDevsecops, crearSolicitudHelpdesk, normalizarHistoria, validarHistoria, armarHistoria,
  validarInstrucciones, plantillaInstrucciones, revisarSolicitanteOcd, revisarHistoriaEInstrucciones, combinarSolicitante,
} from "./engine.mjs";

const quitarAcentos = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const esPregunta = (t) => /[?¿]/.test(t) || t.length > 60;
const nombreCorto = (u) => u.nombre.replace(/ \(.*\)/, "");
const OPCIONES = {
  tipo: ["Estándar", "Normal", "Emergencia"], criticidad: ["Alta", "Media", "Baja"], tamano: ["Pequeño", "Mediano", "Grande"],
  hora: ["22:00", "23:00", "00:00", "02:00"], rollback: ["Sí, probado", "Sí, sin probar", "No"],
};
const SIGUIENTE = { tipo: "criticidad", criticidad: "tamano", tamano: "fecha", rollback: "evidencias" };
const PREGUNTA = {
  tipo: "¿Qué tipo de cambio es? Estándar es repetible, Normal pasa por el CAB y Emergencia atiende un incidente activo.",
  criticidad: "¿Qué criticidad tiene el servicio?", tamano: "¿Qué tamaño tiene el cambio?", hora: "¿A qué hora empieza? La ventana va de 22:00 a 04:00.",
  rollback: "¿Tienes plan de rollback?",
};
const TIPS = {
  crear: "Abre el OCD en Jira con la historia, las evidencias y el plan de rollback.",
  agente: "El agente pre-valida riesgo, calendario, grupos de red e historia en segundos.",
  lider: "El líder técnico revisa el alcance, la historia y tus instrucciones de despliegue.",
  seguridad: "Seguridad revisa los escaneos (SAST, SCA, secretos) y el riesgo del cambio.",
  cab: "Change Management aprueba en la sesión del CAB (martes y jueves a las 10:00).",
  agenda: "Confirma la ventana y avisa a las áreas impactadas.",
  ejecutar: "Ejecuta con el workflow ocd-ejecucion en el ambiente protegido production.",
  verificar: "Vigila métricas y alertas 30 minutos. Si falla, haz rollback.",
  cerrar: "Cierra el OCD y adjunta la evidencia de la ejecución.",
  posteriori: "Seguridad y Change Management aprueban a posteriori (emergencia).",
};

export function crearAsistenteOcd({ say, el, dir, cfg, cal, policy, incidents, historias, ir }) {
  const HOY = cfg.fechaDemo;
  let st = "idle";
  let d = {};
  let nHD = 4800, nHU = 3200, nOCD = 5000;
  const p = (t) => el("p", { textContent: t });
  const lista = (items) => el("ul", {}, items.map((t) => el("li", { textContent: t })));
  const opcion = (etiqueta, accion) => el("button", { type: "button", className: "qr", textContent: etiqueta, onclick: () => { say("user", etiqueta); accion(); } });
  const opciones = (...b) => el("div", { className: "qrs" }, b);
  const reiniciar = () => { st = "idle"; d = {}; };
  const salir = (t) => { reiniciar(); return manejar(t); };
  const grupos = () => revisarGruposDevsecops(d.u, dir, d.extra ?? []);

  /* ---------- Escenario 1: grupos de red DevSecOps ---------- */
  function ofrecer() {
    if (st !== "idle") return;
    st = "oferta";
    say("bot", p("Antes de empezar: ¿quieres que valide con tu matrícula que tengas los grupos de red de DevSecOps? Sin ellos no puedes abrir ni ejecutar un OCD."),
      opciones(opcion("Sí, valídalos", () => pedirMatricula("grupos")), opcion("No, gracias", () => { reiniciar(); say("bot", p("Sin problema. Cuando quieras, escribe «quiero crear un OCD».")); })));
  }

  function pedirMatricula(modo) {
    d = { modo }; st = "matricula";
    say("bot", p("Dime tu matrícula (formato M-12345). Con ella busco tus grupos de red."),
      p("Para la demo puedes usar una de estas matrículas ficticias:"),
      opciones(...Object.values(dir.usuarios).map((u) => opcion(`${u.matricula} · ${nombreCorto(u)}`, () => conMatricula(u.matricula)))));
  }

  function conMatricula(t) {
    if (!normalizarMatricula(t)) {
      if (esPregunta(t)) return salir(t);
      say("bot", p("No reconozco ese formato. La matrícula es una M y cinco dígitos, por ejemplo M-10212.")); return true;
    }
    const u = buscarPorMatricula(dir, t);
    if (!u) { say("bot", p(`No encuentro la matrícula ${normalizarMatricula(t)} en el directorio. Revisa que esté bien escrita o pide tu alta a la mesa de accesos.`)); return true; }
    d.u = u; d.extra = [];
    revisarDso(); return true;
  }

  function revisarDso() {
    const g = grupos();
    say("bot", p(`Hola, ${nombreCorto(d.u)}. Grupos de red de DevSecOps para tu matrícula ${d.u.matricula}:`),
      lista(g.grupos.map((x) => `${x.tiene ? "✅" : "❌"} ${x.id} · ${x.nombre}`)));
    if (g.completo) { say("bot", p("Tienes todos los grupos de DevSecOps.")); despuesDeGrupos(); return; }
    st = "helpdesk";
    say("bot", p(`Te faltan ${g.faltan.length}: ${g.faltan.map((x) => x.id).join(", ")}. ${dir.solicitudRed.ayuda}`),
      p("¿Quieres que yo cree la solicitud de estos grupos en Helpdesk?"),
      opciones(opcion("Sí, créala", crearHelpdesk), opcion("No, la haré yo", () => { say("bot", p(`Entendido. ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}.`)); despuesDeGrupos(); })));
  }

  function crearHelpdesk() {
    const ids = grupos().faltan.map((x) => x.id);
    const hd = crearSolicitudHelpdesk({ usuario: d.u, ids, dir, numero: ++nHD });
    d.hd = hd;
    say("bot", p("Listo, creé la solicitud (simulada):"),
      el("div", { className: "card hd" },
        el("strong", { textContent: `${hd.key} · ${hd.cola}` }),
        lista([`Estado: ${hd.estado}`, `Solicitante: ${hd.solicitante}`, `Grupos: ${hd.grupos.map((x) => x.id).join(", ")}`, `Aprobador: ${hd.aprobador}`, `Tiempo estimado: ${hd.sla}`])),
      p("En la vida real tu líder técnico la aprueba y los grupos llegan en unos días. Para la demo puedo simular esa aprobación."),
      opciones(opcion("Simular aprobación del líder", () => { d.extra = ids; say("bot", p(`${hd.key} aprobada y grupos asignados (simulado). Ya tienes los grupos de DevSecOps.`)); despuesDeGrupos(); }),
        opcion("Seguir sin esperar", despuesDeGrupos)));
  }

  function despuesDeGrupos() {
    if (d.modo === "crear") { pedirHistoria(); return; }
    st = "crear?";
    say("bot", p("¿Seguimos con la creación del OCD?"), opciones(opcion("Sí, crear el OCD", () => { d.modo = "crear"; pedirHistoria(); }), opcion("Por ahora no", () => { reiniciar(); say("bot", p("Cuando quieras, escribe «quiero crear un OCD».")); })));
  }

  /* ---------- Escenario 2: historia ---------- */
  function pedirHistoria() {
    st = "historia";
    say("bot", p("Para crear el OCD necesito tu historia, la HU que origina el cambio (formato HU-1234)."),
      opciones(...historias.slice(0, 3).map((h) => opcion(h.id, () => conHistoria(h.id))), opcion("No sé mi historia, ayúdame", ayudaHistoria)));
  }

  function conHistoria(t) {
    if (/no\s+(se|tengo|conozco|recuerdo)|ayud|crear|nueva/.test(quitarAcentos(t))) { ayudaHistoria(); return true; }
    const id = normalizarHistoria(t.match(/hu-?\d{4}/i)?.[0] ?? t);
    if (!id) {
      if (esPregunta(t)) return salir(t);
      say("bot", p("No reconozco ese formato. La historia es HU y cuatro dígitos, por ejemplo HU-3101. Si no la tienes, escribe «no sé» y te ayudo a crearla.")); return true;
    }
    const v = validarHistoria({ historia: id, servicio: d.svc }, historias);
    if (!v.ok) { say("bot", p(`${v.motivo}. Revisa el número o escribe «no sé» para crear una nueva.`)); return true; }
    d.historia = v.historia; d.svc = v.historia.servicio;
    say("bot", p(`Encontré ${v.id}: ${v.historia.titulo} (${v.historia.estado}), del servicio ${d.svc}. La asocio al OCD.`));
    pedirCampo("tipo"); return true;
  }

  function ayudaHistoria() {
    st = "hsvc";
    say("bot", p("Sin problema, armamos tu historia en tres preguntas. ¿De qué servicio es el cambio?"),
      opciones(...Object.keys(dir.servicios).map((s) => opcion(s, () => conHsvc(s)))));
  }
  function conHsvc(t) {
    const k = Object.keys(dir.servicios).find((s) => quitarAcentos(t).includes(s));
    if (!k) { if (esPregunta(t)) return salir(t); say("bot", p(`No conozco ese servicio. Elige uno: ${Object.keys(dir.servicios).join(", ")}.`)); return true; }
    d.svc = k; st = "hrol";
    say("bot", p("¿Quién es el usuario que se beneficia? Es el «Como …» de la historia."), opciones(...["cliente del banco", "analista de operaciones", "ejecutivo de atención"].map((r) => opcion(r, () => conHrol(r)))));
    return true;
  }
  function conHrol(t) {
    if (t.length < 3) { say("bot", p("Dime quién se beneficia, por ejemplo «cliente del banco».")); return true; }
    d.hrol = t.slice(0, 60); st = "hobj";
    say("bot", p("¿Qué quiere lograr? Es el «quiero …»: describe el cambio, por ejemplo «ver el motivo del rechazo de un pago»."));
    return true;
  }
  function conHobj(t) {
    if (t.length < 8) { say("bot", p("Cuéntame un poco más (al menos 8 caracteres): qué cambia para el usuario.")); return true; }
    d.hobj = t.slice(0, 140); st = "hben";
    say("bot", p("¿Para qué lo quiere? Es el «para …»: el beneficio, por ejemplo «resolver sus dudas sin llamar»."));
    return true;
  }
  function conHben(t) {
    if (t.length < 5) { say("bot", p("Cuéntame el beneficio con algo más de detalle.")); return true; }
    const h = armarHistoria({ rol: d.hrol, objetivo: d.hobj, beneficio: t, servicio: d.svc, numero: ++nHU });
    historias.push({ id: h.id, servicio: h.servicio, titulo: h.titulo, estado: h.estado, responsable: nombreCorto(d.u) });
    d.historia = h;
    say("bot", p("Listo, creé tu historia (simulada):"),
      el("div", { className: "card hd" }, el("strong", { textContent: `${h.id} · ${h.servicio}` }), p(h.descripcion), p("Criterios de aceptación:"), lista(h.criterios)),
      p("La asocio a tu OCD."));
    pedirCampo("tipo"); return true;
  }

  /* ---------- Datos del OCD (todos menos las instrucciones) ---------- */
  function pedirCampo(campo) {
    st = campo;
    if (campo === "fecha") {
      d.sugerida = d.tipo === "Emergencia" ? HOY : proximaVentana(d.tipo, HOY, cfg, cal);
      say("bot", p(`¿Para qué noche? Escribe la fecha AAAA-MM-DD (martes a jueves).${d.tipo === "Emergencia" ? " Una emergencia se ejecuta ya." : ""}`),
        d.sugerida ? opciones(opcion(`Usar la sugerida: ${fmtFechaCorta(d.sugerida)} (${d.sugerida})`, () => { d.fecha = d.sugerida; pedirCampo("hora"); })) : "");
      return;
    }
    if (campo === "evidencias") { pedirEvidencias(); return; }
    if (campo === "descripcion") {
      say("bot", p("Describe en una o dos frases qué cambia y cómo se verifica que salió bien (puedes omitirlo)."), opciones(opcion("Omitir", () => { d.descripcion = ""; crearOcd(); })));
      return;
    }
    say("bot", p(PREGUNTA[campo]), opciones(...OPCIONES[campo].map((o) => opcion(o, () => asignar(campo, o)))));
  }

  function asignar(campo, valor) {
    d[campo] = valor;
    if (campo === "hora") { pedirCampo("rollback"); return; }
    pedirCampo(SIGUIENTE[campo]);
  }

  function pedirEvidencias() {
    st = "evidencias";
    const todos = { ...Object.fromEntries(Object.entries(policy.controles).map(([k, c]) => [k, c.etiqueta])) };
    const extra = Object.fromEntries(Object.entries(cfg.controles).map(([k, c]) => [k, c.etiqueta]));
    d.sel = new Set([...Object.keys(todos), ...Object.keys(extra)]);
    const botones = [...Object.entries(todos), ...Object.entries(extra)].map(([k, et]) => {
      const b = el("button", { type: "button", className: "qr on", textContent: `✅ ${et}` });
      b.addEventListener("click", () => { const on = d.sel.has(k); on ? d.sel.delete(k) : d.sel.add(k); b.className = on ? "qr" : "qr on"; b.textContent = `${on ? "⬜" : "✅"} ${et}`; });
      return b;
    });
    say("bot", p("¿Qué evidencias ya tienes? Todas están marcadas: desmarca las que te faltan y pulsa Continuar."), el("div", { className: "qrs col" }, botones),
      opciones(opcion("Continuar", () => { d.checks = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, d.sel.has(k)])); d.ocdChecks = Object.fromEntries(Object.keys(cfg.controles).map((k) => [k, d.sel.has(k)])); pedirCampo("descripcion"); })));
  }

  /* ---------- Crear el OCD simulado y guiar ---------- */
  function datosOcd(instrucciones = "") {
    const u2 = { ...d.u, gruposDevsecops: [...(d.u.gruposDevsecops ?? []), ...(d.extra ?? [])] };
    const dir2 = { ...dir, usuarios: { ...dir.usuarios, [d.u.id]: u2 } };
    const change = { servicio: d.svc, tipo: d.tipo, criticidad: d.criticidad, tamano: d.tamano, rollback: d.rollback, checks: d.checks };
    const sol = revisarSolicitanteOcd({ servicio: d.svc, matricula: d.u.matricula }, dir2);
    const rev = revisarHistoriaEInstrucciones({ historia: d.historia.id, instrucciones, servicio: d.svc, criticidad: d.criticidad }, historias);
    const r = combinarSolicitante(assessOcd({ change, fecha: d.fecha, hora: d.hora, ocdChecks: d.ocdChecks }, incidents, policy, cfg, cal, HOY), sol, rev);
    return { r, sol, rev };
  }

  function crearOcd() {
    const { r } = datosOcd();
    d.key = `OCD-${++nOCD}`; d.r = r;
    const eq = validarEquipoOcd({ servicio: d.svc, usuarioId: d.u.id, tipo: d.tipo }, dir, cfg);
    say("bot", el("h3", { textContent: `${d.key} creado en Jira (simulado)` }),
      p(`${nombreCorto(d.u)} (${d.u.matricula}) · ${d.svc} · ${d.tipo} · ${d.fecha} ${d.hora} (${r.dia}) · historia ${d.historia.id}`),
      p(`Pre-validación del agente: ${r.estado}, riesgo ${r.nivel} (${r.score}/100).`),
      r.blockers.length ? el("div", {}, p("🛑 Esto bloquea el OCD:"), lista(r.blockers)) : p("✅ Sin bloqueos."),
      r.sugerida && r.blockers.length ? p(`Fecha sugerida: ${r.sugerida} (${fmtFechaCorta(r.sugerida)}).`) : "",
      p("👥 Aprobadores de este OCD:"), lista(r.aprobadores.map((a) => { const x = eq.roles.find((y) => y.rol === a.replace(/\s*\(.*\)$/, "")); return x ? `${a}: ${x.esperadoNombre}` : a; })),
      p("Ahora te guío paso a paso por la gestión del OCD. En la revisión del líder técnico validaré tus instrucciones de despliegue."));
    d.etapas = r.plan; d.i = 0;
    siguienteEtapa();
  }

  function siguienteEtapa() {
    const e = d.etapas[d.i];
    if (!e) { fin(); return; }
    if (e.id === "lider" && !d.instrOk) { pedirInstrucciones(e); return; }
    mostrarEtapa(e);
  }

  function mostrarEtapa(e) {
    st = "guia";
    const n = d.etapas.length;
    say("bot", el("h3", { textContent: `Paso ${d.i + 1} de ${n} · ${e.nombre}` }),
      p(`${fmtFechaCorta(e.fecha)}${e.hora ? ` ${e.hora}` : ""} · Responsable: ${e.responsable}`), p(TIPS[e.id] ?? ""),
      e.id === "agente" && d.r.blockers.length ? p("⚠️ El agente dejó el OCD en Bloqueado. Corrige lo anterior y se vuelve a evaluar al editar el ticket. Aquí seguimos para que aprendas el flujo completo.") : "",
      opciones(opcion(d.i + 1 < n ? "Hecho, siguiente" : "Hecho, terminar", () => { d.i++; siguienteEtapa(); })));
  }

  function pedirInstrucciones(e) {
    st = "instr";
    const ta = el("textarea", { rows: 7, className: "instr", placeholder: "1. …\n2. …\n3. …\nIncluye rollback y verificación posterior" });
    const salida = el("div", { className: "instr-out" });
    const validar = () => revisarInstr(ta.value, salida);
    d.ta = ta;
    say("bot", el("h3", { textContent: `Revisión técnica · ${e.nombre}` }),
      p("Aquí el líder técnico revisa tus instrucciones de despliegue y yo las valido antes: pasos numerados, rollback, verificación posterior, sin credenciales ni comandos peligrosos."),
      ta, salida,
      opciones(el("button", { type: "button", className: "qr", textContent: "Validar mis instrucciones", onclick: validar }),
        el("button", { type: "button", className: "qr", textContent: "No sé cómo escribirlas, dame una plantilla", onclick: () => { ta.value = plantillaInstrucciones({ servicio: d.svc, historia: d.historia.id, fecha: d.fecha, hora: d.hora }); salida.replaceChildren(el("p", { textContent: "Te dejé una plantilla. Ajústala a tu cambio y pulsa Validar." })); } })));
  }

  function revisarInstr(texto, salida) {
    const v = validarInstrucciones(texto, { servicio: d.svc, criticidad: d.criticidad });
    if (!v.ok) {
      salida.replaceChildren(el("p", { textContent: "🛑 Aún no pasan la revisión. Corrige y valida de nuevo:" }), lista(v.bloqueos), v.avisos.length ? lista(v.avisos.map((a) => `Aviso: ${a}`)) : "");
      return;
    }
    d.instr = texto; d.instrOk = true;
    salida.replaceChildren(el("p", { textContent: `✅ Instrucciones válidas (${v.pasos} pasos).` }), v.avisos.length ? lista(v.avisos.map((a) => `Aviso: ${a}`)) : "");
    const e = d.etapas[d.i];
    st = "guia";
    say("bot", p("El líder técnico recibe tus instrucciones validadas."), opciones(opcion("Continuar", () => mostrarEtapa(e))));
  }

  function fin() {
    st = "fin";
    say("bot", el("h3", { textContent: `${d.key} completado (simulado)` }),
      p("Recorriste todo el flujo: grupos de red, historia, datos, aprobaciones, instrucciones validadas, ejecución, verificación y cierre."),
      opciones(opcion("Abrir el simulador de Jira con mis datos", () => ir({ usuario: d.u.id, servicio: d.svc, tipo: d.tipo, fecha: d.fecha, historia: d.historia.id, historiaObj: { id: d.historia.id, servicio: d.svc, titulo: d.historia.titulo, estado: d.historia.estado }, gruposExtra: d.extra ?? [], instrucciones: d.instr ?? "" })),
        opcion("Crear otro OCD", () => iniciarCrear()), opcion("Terminar", () => { reiniciar(); say("bot", p("¡Éxito con tu OCD! Si te trabas, pregúntame lo que necesites.")); })));
  }

  function iniciarCrear() {
    if (d.u) { const u = d.u, extra = d.extra ?? []; d = { modo: "crear", u, extra }; say("bot", p(`Sigo con tu matrícula ${u.matricula}.`)); revisarDso(); return; }
    pedirMatricula("crear");
  }

  /* ---------- Entrada de texto ---------- */
  function manejar(texto) {
    const t = String(texto ?? "").trim();
    const q = quitarAcentos(t);
    if (/^(cancelar|salir)$/.test(q) && st !== "idle") { reiniciar(); say("bot", p("Listo, lo dejamos aquí. Cuando quieras, escribe «quiero crear un OCD».")); return true; }
    if (st === "idle") {
      if (!/[?¿]/.test(t) && /\bocd\b/.test(q) && /(crear|crea|creo|armar|abrir|generar|ayud)/.test(q)) { iniciarCrear(); return true; }
      return false;
    }
    if (st === "oferta") {
      if (/^(si|claro|dale|ok|vale|ayuda|por favor)\b/.test(q)) { pedirMatricula("grupos"); return true; }
      if (/^no\b/.test(q)) { reiniciar(); say("bot", p("Sin problema. Cuando quieras, escribe «quiero crear un OCD».")); return true; }
      return salir(t);
    }
    if (st === "crear?") {
      if (/^(si|claro|dale|ok|vale|crear)/.test(q)) { d.modo = "crear"; pedirHistoria(); return true; }
      return salir(t);
    }
    if (st === "helpdesk") {
      if (/^(si|claro|dale|ok|vale|crea)/.test(q)) { crearHelpdesk(); return true; }
      if (/^no\b/.test(q)) { say("bot", p(`Entendido. ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}.`)); despuesDeGrupos(); return true; }
      return salir(t);
    }
    if (st === "fin") {
      if (/^(nuevo|otro|empez|crear)/.test(q)) { iniciarCrear(); return true; }
      if (/^(fin|terminar)/.test(q)) { reiniciar(); say("bot", p("¡Éxito con tu OCD! Si te trabas, pregúntame lo que necesites.")); return true; }
      return salir(t);
    }
    if (st === "guia") {
      if (/^(hecho|siguiente|listo|ok|continuar)/.test(q)) { d.i++; siguienteEtapa(); return true; }
      return salir(t);
    }
    if (st === "matricula") return conMatricula(t);
    if (st === "historia") return conHistoria(t);
    if (st === "hsvc") return conHsvc(t);
    if (st === "hrol") return conHrol(t);
    if (st === "hobj") return conHobj(t);
    if (st === "hben") return conHben(t);
    if (st === "instr") {
      const salida = d.ta?.parentElement?.querySelector(".instr-out");
      if (salida && t.length > 20) { d.ta.value = t; revisarInstr(t, salida); return true; }
      say("bot", p("Escribe tus instrucciones en el cuadro de arriba y pulsa «Validar mis instrucciones»."));
      return true;
    }
    if (st === "fecha") {
      const m = t.match(/\d{4}-\d{2}-\d{2}/);
      const f = /sugerid|usar/.test(q) ? d.sugerida : m?.[0];
      if (!f || !fechaValida(f)) {
        if (esPregunta(t) && !m) return salir(t);
        say("bot", p("No pude leer esa fecha. Usa el formato AAAA-MM-DD, por ejemplo 2026-11-24, o pulsa la sugerida.")); return true;
      }
      d.fecha = f; pedirCampo("hora"); return true;
    }
    if (OPCIONES[st]) {
      const k = OPCIONES[st].find((o) => q.includes(quitarAcentos(o)) || (st === "rollback" && o === "No" && /^no\b/.test(q)));
      if (!k) { if (esPregunta(t)) return salir(t); say("bot", p(`Elige una opción: ${OPCIONES[st].join(", ")}.`)); return true; }
      asignar(st, k); return true;
    }
    if (st === "evidencias") { say("bot", p("Marca las evidencias con los botones y pulsa Continuar.")); return true; }
    if (st === "descripcion") { d.descripcion = t.slice(0, 500); crearOcd(); return true; }
    return false;
  }

  return { ofrecer, iniciar: iniciarCrear, manejar, get activo() { return st !== "idle"; } };
}
