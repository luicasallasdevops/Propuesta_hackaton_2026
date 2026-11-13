// Asistente conversacional del OCD (reglas deterministas, sin IA generativa, solo nodos DOM).
// Escenario 1: el usuario pregunta cómo crear un OCD -> el agente valida sus grupos de red de DevSecOps y, si faltan, ofrece pedirlos en Helpdesk.
// Escenario 2: el usuario pide crear un OCD -> historia (validar o crear), datos del OCD, guía interactiva y validación de instrucciones en las revisiones técnicas.
import {
  assessOcd, buscarPorMatricula, normalizarMatricula, validarEquipoOcd, proximaVentana, fechaValida, fmtFechaCorta,
  revisarGruposDevsecops, crearSolicitudHelpdesk, normalizarHistoria, validarHistoria, armarHistoria,
  validarInstrucciones, plantillaInstrucciones, revisarSolicitanteOcd, revisarHistoriaEInstrucciones, combinarSolicitante,
} from "./engine.mjs";
import { extraerDatos } from "./conversacion.mjs";
import { validarConjuntos, plantillaConjunto, ejecutaAutomatico, avanzaSolo, rolDeTexto, pendientesDeRol, rolNombre, transicionesDe } from "./flujo.mjs";
import { detalle, campoTexto, abrirDialogo, enlace } from "./ui.js";

const DOC_FLUJO = { texto: "Flujo del OCD (documento 13)", ruta: "documentacion/13-flujo-ocd.md" };
const DOC_GUIA = { texto: "Guía del OCD en la base de conocimiento", ruta: "knowledge/06-ocd-pase-a-produccion.md" };
const DOC_CAL = { texto: "Calendario del OCD (wiki)", ruta: "wiki:Calendario-del-OCD" };
const DOC_RIESGO = { texto: "Riesgo y bloqueos (wiki)", ruta: "wiki:Riesgo-y-bloqueos" };

const quitarAcentos = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const esPregunta = (t) => /[?¿]/.test(t) || t.length > 60;
const nombreCorto = (u) => u.nombre.replace(/ \(.*\)/, "");
const OPCIONES = {
  tipo: ["Estándar", "Normal", "Emergencia"], criticidad: ["Alta", "Media", "Baja"],
  hora: ["22:00", "23:00", "00:00", "02:00"], rollback: ["Sí, probado", "Sí, sin probar", "No"],
};
const SIGUIENTE = { tipo: "criticidad", criticidad: "rollback", rollback: "evidencias" };
const PREGUNTA = {
  tipo: "¿Qué tipo de cambio es? Estándar es repetible, Normal pasa por el Comité de Gestión de Cambios y Emergencia atiende un incidente activo.",
  criticidad: "¿Qué criticidad tiene el servicio?", hora: "¿A qué hora empieza? La ventana va de 22:00 a 04:00.",
  rollback: "¿Tienes plan de rollback?",
};
const CALENDARIO_RX = /ventana|feriado|congelamiento|cupo|Anticipación|futura|Fuera/i;

export function crearAsistenteOcd({ say, el, dir, cfg, cal, policy, incidents, historias, flujo, ir }) {
  const HOY = cfg.fechaDemo;
  let st = "idle";
  let d = {};
  let nHD = 4800, nHU = 3200, nOCD = 5000;
  const paso = (x) => document.dispatchEvent(new CustomEvent("ocd:paso", { detail: x }));
  const p = (t) => el("p", { textContent: t });
  const lista = (items) => el("ul", {}, items.map((t) => el("li", { textContent: t })));
  const opcion = (etiqueta, accion) => el("button", { type: "button", className: "qr", textContent: etiqueta, onclick: () => { say("user", etiqueta); accion(); } });
  const opciones = (...b) => el("div", { className: "qrs" }, b);
  let pre = {};     // datos que el usuario ya dio en la conversación (servicio, fecha, rollback…)
  let pausa = null; // OCD a medias cuando el usuario hace una pregunta en medio
  const fuera = () => document.dispatchEvent(new CustomEvent("ocd:fuera"));
  const reiniciar = () => { st = "idle"; d = {}; pausa = null; fuera(); };
  const salir = (t) => { if (st !== "idle" && st !== "fin" && !pausa) pausa = { st, d }; st = "idle"; d = {}; fuera(); return interno(t); };

  /* ---------- Escenario 1: matrícula, rol y grupos de red ---------- */
  const grupos = () => revisarGruposDevsecops(d.u, dir, d.extra ?? [], d.perfil);
  const DOC_GRUPOS = { texto: "Grupos de red por rol (guía del OCD)", ruta: "knowledge/06-ocd-pase-a-produccion.md" };

  function ofrecer() {
    if (st !== "idle") return;
    st = "oferta";
    say("bot", p("Antes de empezar: ¿quieres que valide con tu matrícula que tengas los grupos de red necesarios? Sin ellos no puedes abrir ni ejecutar un OCD."),
      opciones(opcion("Sí, valídalos", () => pedirMatricula("grupos")), opcion("No, gracias", () => { reiniciar(); say("bot", p("Sin problema. Cuando quieras, escribe «quiero crear un OCD».")); })));
  }

  const campoMatricula = () => campoTexto({ etiqueta: "Matrícula", placeholder: "Ej: M-10212", boton: "Validar matrícula", maxLength: 12, onEnviar: (v) => { say("user", v); conMatricula(v); } });
  const demoMatriculas = () => detalle("Matrículas de la demostración", lista(Object.values(dir.usuarios).map((u) => `${u.matricula} · ${nombreCorto(u)} (${u.detalle})`)));

  function pedirMatricula(modo) {
    paso("matricula");
    pausa = null; d = { modo }; st = "matricula";
    say("bot", p("Escribe tu matrícula (formato M-12345) y busco tus grupos de red."), campoMatricula(), demoMatriculas());
  }

  function conMatricula(t) {
    if (!normalizarMatricula(t)) {
      if (esPregunta(t)) return salir(t);
      say("bot", p("No reconozco ese formato. La matrícula es una M y cinco dígitos, por ejemplo M-10212."), campoMatricula()); return true;
    }
    const u = buscarPorMatricula(dir, t);
    if (!u) { say("bot", p(`No encuentro la matrícula ${normalizarMatricula(t)} en el directorio. Revisa que esté bien escrita o pide tu alta a la mesa de accesos.`), campoMatricula(), demoMatriculas()); return true; }
    d.u = u; d.extra = []; d.perfil = null;
    if (pre.servicio) d.svc = pre.servicio;
    pedirPerfil(); return true;
  }

  function pedirPerfil() {
    paso("grupos");
    st = "perfil";
    say("bot", p(`Hola, ${nombreCorto(d.u)}. ¿Con qué rol vas a participar en este OCD?`),
      opciones(opcion("Líder técnico (LT)", () => conPerfil("Líder técnico")), opcion("Team Member (TM)", () => conPerfil("Team Member"))),
      detalle("¿Qué grupos exige cada rol?", lista(["Líder técnico (LT): grupos ADMIN → INCT_ADMIN_INCT_PROD y VSDP-ADMIN.", "Team Member (TM): grupos DEVELOPER → INCT_DEVELOPER_INCT_PROD y VSDP-DEVELOPER."]), DOC_GRUPOS));
  }

  function conPerfil(perfil) { d.perfil = perfil; revisarDso(); }

  function revisarDso() {
    const g = grupos();
    say("bot", p(g.completo ? `✅ Tienes los ${g.grupos.length} grupos de red que exige el rol ${d.perfil}.` : `Como ${d.perfil} te faltan ${g.faltan.length} de ${g.grupos.length} grupos de red: ${g.faltan.map((x) => x.id).join(", ")}.`),
      detalle("Ver mis grupos de red", [p(`Matrícula ${d.u.matricula} · rol ${d.perfil}`), lista(g.grupos.map((x) => `${x.tiene ? "✅" : "❌"} ${x.id} · ${x.nombre}`))], DOC_GRUPOS));
    if (g.completo) { despuesDeGrupos(); return; }
    st = "helpdesk";
    say("bot", p("¿Quieres que yo cree la solicitud de estos grupos en Helpdesk?"),
      opciones(opcion("Sí, créala", crearHelpdesk), opcion("No, la haré yo", () => { say("bot", p(`Entendido. Tarda ${dir.solicitudRed.sla}.`), detalle("Cómo pedirlos", [p(dir.solicitudRed.como), p(dir.solicitudRed.ayuda)], DOC_GRUPOS)); despuesDeGrupos(); })));
  }

  function crearHelpdesk() {
    const ids = grupos().faltan.map((x) => x.id);
    const hd = crearSolicitudHelpdesk({ usuario: d.u, ids, dir, numero: ++nHD });
    d.hd = hd;
    say("bot", p(`Listo, creé la solicitud ${hd.key} en Helpdesk. Tu líder técnico la aprueba y los grupos llegan en ${hd.sla}.`),
      detalle(`Ver la solicitud ${hd.key}`, lista([`Cola: ${hd.cola}`, `Estado: ${hd.estado}`, `Solicitante: ${hd.solicitante}`, `Grupos: ${hd.grupos.map((x) => x.id).join(", ")}`, `Aprobador: ${hd.aprobador}`]), DOC_GRUPOS),
      opciones(opcion("Ya me asignaron los grupos", () => { d.extra = ids; say("bot", p(`${hd.key} aprobada: ya tienes los grupos de red.`)); despuesDeGrupos(); }),
        opcion("Seguir sin esperar", despuesDeGrupos)));
  }

  function despuesDeGrupos() {
    if (d.modo === "crear") { pedirHistoria(); return; }
    st = "crear?";
    say("bot", p("¿Seguimos con la creación del OCD?"), opciones(opcion("Sí, crear el OCD", () => { d.modo = "crear"; pedirHistoria(); }), opcion("Por ahora no", () => { reiniciar(); say("bot", p("Cuando quieras, escribe «quiero crear un OCD».")); })));
  }

  /* ---------- Historia: se busca en Jira y el usuario la confirma ---------- */
  const campoHistoria = () => campoTexto({ etiqueta: "Historia", placeholder: "Ej: HU-3101", boton: "Buscar en Jira", maxLength: 12, onEnviar: (v) => { say("user", v); conHistoria(v); } });
  const demoHistorias = () => detalle("Historias de la demostración", lista(historias.map((h) => `${h.id} · ${h.titulo} (${h.servicio})`)));

  function pedirHistoria() {
    paso("historia");
    st = "historia";
    say("bot", p("Escribe el número de tu historia, la HU que origina el cambio (formato HU-1234). La busco en Jira."), campoHistoria(),
      opciones(opcion("No tengo historia, ayúdame a crearla", ayudaHistoria)), demoHistorias());
  }

  function conHistoria(t) {
    if (/no\s+(se|tengo|conozco|recuerdo)|ayud|crear|nueva/.test(quitarAcentos(t))) { ayudaHistoria(); return true; }
    const id = normalizarHistoria(t.match(/hu-?\d{4}/i)?.[0] ?? t);
    if (!id) {
      if (esPregunta(t)) return salir(t);
      say("bot", p("No reconozco ese formato. La historia es HU y cuatro dígitos, por ejemplo HU-3101."), campoHistoria(), opciones(opcion("No tengo historia, ayúdame a crearla", ayudaHistoria))); return true;
    }
    const h = historias.find((x) => x.id === id);
    if (!h) {
      say("bot", p(`Busqué ${id} en Jira y no existe. Revisa el número o crea una nueva.`), campoHistoria(), opciones(opcion("No tengo historia, ayúdame a crearla", ayudaHistoria)), demoHistorias()); return true;
    }
    d.hpend = h; st = "hconf";
    say("bot", p(`Encontré ${h.id} en Jira. ¿Es esta tu historia?`),
      el("div", { className: "card hd" }, el("strong", { textContent: `${h.id} · ${h.titulo}` }), lista([`Tablero: ${h.tablero}`, `Creada por: ${h.creadoPor}`, `Estado: ${h.estado}`, `Servicio: ${h.servicio}`])),
      opciones(opcion("Sí, es esta", confirmarHistoria), opcion("No, buscar otra", pedirHistoria)));
    return true;
  }

  function confirmarHistoria() {
    const h = d.hpend; d.historia = h;
    const aviso = d.svc && d.svc !== h.servicio ? ` Ojo: habías mencionado ${d.svc}; uso el servicio de la historia (${h.servicio}).` : "";
    d.svc = h.servicio;
    say("bot", p(`Listo, asocio ${h.id} al OCD.${aviso}`));
    pedirModalidad();
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
    const nueva = { id: h.id, servicio: h.servicio, titulo: h.titulo, estado: h.estado, responsable: nombreCorto(d.u), creadoPor: nombreCorto(d.u), tablero: `Tablero ${h.servicio}` };
    historias.push(nueva);
    d.historia = nueva;
    say("bot", p(`Listo, creé ${h.id} en Jira y la asocio a tu OCD.`),
      detalle(`Ver la historia ${h.id}`, [p(h.descripcion), p("Criterios de aceptación:"), lista(h.criterios)]));
    pedirModalidad(); return true;
  }

  /* ---------- Modalidad del OCD, con ejemplos y enlace a la documentación ---------- */
  function pedirModalidad() {
    paso("modalidad");
    st = "modalidad";
    const cards = Object.entries(flujo.modalidades).map(([k, m]) => el("div", { className: "mod-card" },
      el("strong", { textContent: k }), p(m.descripcion),
      m.ejemplo ? detalle(`Ver un ejemplo de OCD ${k}`, [p(`${m.ejemplo.ocd} · ${m.ejemplo.servicio}: ${m.ejemplo.resumen}`), lista(m.ejemplo.pasos)], { texto: "Documentación de las modalidades", ruta: m.ejemplo.doc }) : "",
      opciones(opcion(`Elegir ${k}`, () => conModalidad(k)))));
    say("bot", p("¿Qué modalidad tendrá el OCD? Define quién ejecuta las instrucciones. Mira un ejemplo de cada una antes de elegir."), el("div", { className: "mod-grid" }, cards));
  }
  function conModalidad(k) {
    d.modalidad = k;
    say("bot", p(`Modalidad ${k}. ${k === "Híbrido" ? "Recuerda etiquetar cada paso de las instrucciones como [AUTO] o [MANUAL]." : k === "DeployGO" ? "Los cambios de estado los moverán eventos de git (PR, tags)." : k === "Automatizado" ? "Todos los pasos deben ser automáticos ([AUTO], con workflow, pipeline o script)." : "Las instrucciones las ejecuta a mano agileOps."}`));
    for (const x of ["tipo", "criticidad", "fecha", "hora", "rollback"]) if (pre[x]) d[x] = pre[x];
    const ya = ["tipo", "criticidad", "rollback"].filter((x) => d[x]);
    if (ya.length) say("bot", p(`Ya tengo estos datos de lo que me contaste: ${ya.map((x) => `${x} ${d[x]}`).join(" · ")}. Te pregunto solo lo que falta.${d.fecha ? " La fecha la definimos más adelante, en Gestión de pase." : ""}`));
    pedirCampo("tipo");
  }

  /* ---------- Datos del OCD (sin fecha: la fecha se define en Gestión de pase) ---------- */
  const ORDEN = ["tipo", "criticidad", "rollback", "evidencias", "descripcion"];

  function abrirCriticidad() {
    const c = cfg.criticidades ?? {};
    const tabla = el("div", { className: "crit-tabla" }, ["Alta", "Media", "Baja"].filter((k) => c[k]).map((k) => el("div", { className: "crit-fila" },
      el("strong", { textContent: `${k} · ${policy.criticidad[k] ?? 0} pts de riesgo` }), p(c[k].resumen), p(`Ejemplos: ${c[k].ejemplos.join(", ")}.`), p(c[k].efecto))));
    const doc = { texto: "Criticidad del servicio (guía del OCD)", ruta: c.doc ?? DOC_GUIA.ruta };
    if (!abrirDialogo("¿Cómo elijo la criticidad?", tabla, doc)) say("bot", detalle("¿Cómo elijo la criticidad?", tabla, doc));
  }

  function pedirCampo(campo) {
    if (campo !== "hora") paso("datos");
    if (["tipo", "criticidad", "rollback"].includes(campo) && d[campo]) return pedirCampo(ORDEN[ORDEN.indexOf(campo) + 1]);
    st = campo;
    if (campo === "evidencias") { pedirEvidencias(); return; }
    if (campo === "descripcion") {
      say("bot", p("Describe en una o dos frases qué cambia y cómo se verifica que salió bien (puedes omitirlo)."), opciones(opcion("Omitir", () => { d.descripcion = ""; crearOcd(); })));
      return;
    }
    const extra = campo === "criticidad"
      ? el("p", { className: "ayuda" }, el("button", { type: "button", className: "link", textContent: "ℹ️ ¿Cómo elijo? Ver detalle", onclick: abrirCriticidad }), " · ", enlace("Documentación ↗", cfg.criticidades?.doc ?? DOC_GUIA.ruta))
      : "";
    say("bot", p(PREGUNTA[campo]), opciones(...OPCIONES[campo].map((o) => opcion(o, () => asignar(campo, o)))), extra);
  }

  function asignar(campo, valor) {
    d[campo] = valor;
    if (campo === "hora") { evaluarFechaPase(); return; }
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
    say("bot", p("¿Qué evidencias ya tienes? Todas están marcadas: desmarca las que te faltan y pulsa Continuar."), detalle("Ver las evidencias y requisitos", el("div", { className: "qrs col" }, botones), DOC_GUIA),
      opciones(opcion("Continuar", () => { d.checks = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, d.sel.has(k)])); d.ocdChecks = Object.fromEntries(Object.keys(cfg.controles).map((k) => [k, d.sel.has(k)])); pedirCampo("descripcion"); })));
    // las evidencias son la acción de este paso: se dejan abiertas
    document.querySelector(".log .msg:last-child details.det")?.setAttribute("open", "");
  }

  /* ---------- Crear el OCD y guiar estado por estado ---------- */
  const fechaProvisional = () => d.fecha ?? (d.tipo === "Emergencia" ? HOY : proximaVentana(d.tipo, HOY, cfg, cal) ?? HOY);

  function datosOcd(instrucciones = "", fecha = fechaProvisional()) {
    const u2 = { ...d.u, gruposRed: [...(d.u.gruposRed ?? []), ...(d.extra ?? [])] };
    const dir2 = { ...dir, usuarios: { ...dir.usuarios, [d.u.id]: u2 } };
    const change = { servicio: d.svc, tipo: d.tipo, criticidad: d.criticidad, rollback: d.rollback, checks: d.checks };
    const sol = revisarSolicitanteOcd({ servicio: d.svc, matricula: d.u.matricula, perfil: d.perfil }, dir2);
    const rev = revisarHistoriaEInstrucciones({ historia: d.historia.id, instrucciones, servicio: d.svc, criticidad: d.criticidad }, historias);
    const r = combinarSolicitante(assessOcd({ change, fecha, hora: d.hora ?? "22:00", ocdChecks: d.ocdChecks }, incidents, policy, cfg, cal, HOY), sol, rev);
    return { r, sol, rev };
  }

  function crearOcd() {
    const { r } = datosOcd();
    d.key = `OCD-${++nOCD}`; d.r = r; d.fechaOk = false;
    document.dispatchEvent(new CustomEvent("ocd:info", { detail: { key: d.key, modalidad: d.modalidad, servicio: d.svc } }));
    const tecnicos = r.blockers.filter((b) => !CALENDARIO_RX.test(b));
    say("bot", el("h3", { textContent: `${d.key} creado en Jira` }),
      p(`${nombreCorto(d.u)} (${d.perfil}) · ${d.svc} · ${d.tipo} · modalidad ${d.modalidad} · historia ${d.historia.id}`),
      p(tecnicos.length ? `🛑 Pre-validación: ${tecnicos.length} cosa(s) por corregir antes de pedir aprobaciones.` : `✅ Pre-validación: riesgo ${r.nivel} (${r.score}/100), sin bloqueos.`),
      detalle("Ver el detalle de la pre-validación", [tecnicos.length ? lista(tecnicos) : p("Sin bloqueos."), r.advertencias.length ? lista(r.advertencias.map((a) => `⚠️ ${a}`)) : "", p("La fecha y la hora del pase se definen más adelante, en Gestión de pase.")], DOC_RIESGO),
      p("Ahora te acompaño estado por estado. Al salir de Inicio codificación validaré tus cuatro conjuntos de instrucciones."));
    mostrarEstado("inicio");
  }

  /** Contenido de un estado del flujo: lo esencial a la vista y el resto colapsado. */
  function nodosEstado(id) {
    const e = flujo.estados[id];
    const etapa = d.fechaOk ? d.r.plan.find((x) => x.id === e.etapaPlan) : null;
    const auto = ejecutaAutomatico(id, d.modalidad, d.conjVal, flujo);
    const evento = flujo.eventosGit.filter((g) => g.desde === id).map((g) => g.descripcion);
    const total = Object.keys(flujo.estados).length;
    const extras = [];
    extras.push(p(`${e.descripcion}`));
    if (auto && avanzaSolo(d.modalidad, flujo)) extras.push(p(`⚙️ En la modalidad ${d.modalidad} este estado se ejecuta automáticamente. Dime si salió bien o falló para seguir por el camino correcto.`));
    if (flujo.modalidades[d.modalidad]?.gitops && evento.length) extras.push(p(`🔀 DeployGO: lo mueve el evento de git «${evento.join(" / ")}».`));
    if (id === "gestion_pase") extras.push(p("Aprobaciones del pase:"), lista(flujo.aprobadoresPase));
    if (d.r.blockers.length && id === "inicio") extras.push(p("⚠️ El agente dejó el OCD en Bloqueado. Corrige lo anterior y se vuelve a evaluar al editar el ticket. Aquí seguimos para que aprendas el flujo completo."));
    return [el("h3", { textContent: `Estado ${e.orden} de ${total} · ${e.nombre}${e.rama ? " (rama: solo si algo falla)" : ""}` }),
      p(`Lo mueve: ${rolNombre(e.actor, flujo)}${etapa ? ` · ${fmtFechaCorta(etapa.fecha)}${etapa.hora ? ` ${etapa.hora}` : ""}` : ""}`),
      p(e.queHacer), detalle("Más detalle de este estado", extras, DOC_FLUJO)];
  }

  function botonesEstado(id) {
    const e = flujo.estados[id];
    const trans = transicionesDe(flujo, id);
    const bien = trans.find((t) => t.tipo === "avance"), falla = trans.find((t) => t.tipo === "falla"), devolver = trans.find((t) => t.tipo === "devolver");
    const botones = [];
    if (e.final) botones.push(opcion("Terminar", fin));
    else if (id === "inicio") botones.push(opcion("Listo, pasar a Revisiones técnicas", () => (d.instrOk ? mostrarEstado("revisiones") : pedirInstrucciones())));
    else if (falla) {
      botones.push(opcion(`Salió bien → ${flujo.estados[bien.a].nombre}`, () => mostrarEstado(bien.a)));
      botones.push(opcion(`Falló → ${flujo.estados[falla.a].nombre}`, () => mostrarEstado(falla.a)));
    } else if (bien) botones.push(opcion(e.rama ? `Hecho → ${flujo.estados[bien.a].nombre}` : `Aprobado, siguiente → ${flujo.estados[bien.a].nombre}`, () => mostrarEstado(bien.a)));
    if (devolver) botones.push(opcion(`Devolver → ${flujo.estados[devolver.a].nombre}`, () => { d.instrOk = false; say("bot", p("El OCD vuelve a Inicio codificación para corregir las instrucciones.")); mostrarEstado(devolver.a); }));
    return botones;
  }

  function mostrarEstado(id) {
    st = "guia"; d.estado = id;
    paso(id);
    if (id === "gestion_pase" && !d.fechaOk) {
      say("bot", ...nodosEstado(id), p("📅 Aquí se define la fecha del pase: te la pido ahora y la valido con el calendario."));
      pedirFecha(); return;
    }
    say("bot", ...nodosEstado(id), opciones(...botonesEstado(id)));
  }

  /* ---------- Fecha y hora del pase: se piden en Gestión de pase ---------- */
  function pedirFecha() {
    st = "fecha";
    const sugerida = d.tipo === "Emergencia" ? HOY : proximaVentana(d.tipo, HOY, cfg, cal);
    d.sugerida = sugerida;
    const ops = [];
    if (d.fecha) ops.push(opcion(`Usar ${d.fecha} (la que mencionaste)`, () => conFecha(d.fecha)));
    if (sugerida && sugerida !== d.fecha) ops.push(opcion(`Usar la sugerida: ${fmtFechaCorta(sugerida)} (${sugerida})`, () => conFecha(sugerida)));
    say("bot", p(`¿Para qué noche será el pase? Escríbela con tus palabras («el martes», «24 de noviembre») o como AAAA-MM-DD.${d.tipo === "Emergencia" ? " Una emergencia se ejecuta ya." : ""}`), opciones(...ops),
      detalle("Reglas del calendario", lista([`Noches de ${cfg.ventana.dias.join(", ")} entre las ${cfg.ventana.horaInicio} y las ${cfg.ventana.horaFin}.`, `Máximo ${cfg.ventana.maxPorNoche} OCD por noche; sin feriados ni congelamientos.`, "El OCD Normal necesita anticipación para el Comité de Gestión de Cambios."]), DOC_CAL));
  }

  function conFecha(f) {
    d.fecha = f;
    if (d.hora) { evaluarFechaPase(); return; }
    pedirCampo("hora");
  }

  function evaluarFechaPase() {
    const { r } = datosOcd("", d.fecha);
    d.r = r;
    const calend = r.blockers.filter((b) => CALENDARIO_RX.test(b));
    if (calend.length) {
      d.fechaOk = false; st = "fecha";
      const sug = r.sugerida;
      say("bot", p(`🛑 Esa noche no sirve (${d.fecha} ${d.hora}).`), detalle("Ver por qué", lista(calend), DOC_CAL),
        opciones(...(sug ? [opcion(`Usar ${fmtFechaCorta(sug)} (${sug})`, () => conFecha(sug))] : [])),
        p("También puedes escribir otra fecha."));
      return;
    }
    d.fechaOk = true; st = "guia";
    const eq = validarEquipoOcd({ servicio: d.svc, usuarioId: d.u.id, tipo: d.tipo, perfil: d.perfil }, dir, cfg);
    say("bot", el("h3", { textContent: `Fecha confirmada · ${r.dia} ${d.fecha} ${d.hora}` }),
      p(`Estado ${r.estado} · riesgo ${r.nivel} (${r.score}/100).`),
      detalle("Ver el calendario del OCD y los aprobadores", [p("Aprobadores de este OCD:"), lista(r.aprobadores.map((a) => { const x = eq.roles.find((y) => y.rol === a.replace(/\s*\(.*\)$/, "")); return x ? `${a}: ${x.esperadoNombre}` : a; })),
        p("Calendario del OCD:"), lista(r.plan.map((x) => `${x.dia} ${fmtFechaCorta(x.fecha)}${x.hora ? ` ${x.hora}` : ""} · ${x.nombre ?? x.id}`))], DOC_CAL),
      opciones(...botonesEstado("gestion_pase")));
  }

  function pedirInstrucciones() {
    st = "instr";
    const tas = {};
    const caja = el("div", { className: "instr4" }, Object.entries(flujo.conjuntos).map(([id, c]) => {
      const ta = el("textarea", { rows: 5, className: "instr", placeholder: "1. …\n2. …" });
      tas[id] = ta;
      return el("label", {}, c.etiqueta, ta);
    }));
    const salida = el("div", { className: "instr-out" });
    d.tas = tas; d.salida = salida;
    say("bot", el("h3", { textContent: "Revisiones técnicas · valido tus cuatro conjuntos de instrucciones" }),
      p(`Escribe los cuatro conjuntos de instrucciones de tu OCD (modalidad ${d.modalidad}) y pulsa Validar.`),
      detalle("¿Qué reviso en las instrucciones?", p(`${d.modalidad === "Híbrido" ? "Etiqueta cada paso [AUTO] o [MANUAL]. " : d.modalidad === "Manual" ? "Pasos numerados que ejecuta agileOps. " : "Todos los pasos deben ser automáticos (workflow, pipeline o script). "}Reviso pasos numerados, rollback, verificación, credenciales y comandos peligrosos.`), DOC_FLUJO),
      caja, salida,
      opciones(el("button", { type: "button", className: "qr", textContent: "Validar mis instrucciones", onclick: () => revisarInstr() }),
        el("button", { type: "button", className: "qr", textContent: "No sé cómo escribirlas, dame plantillas", onclick: () => {
          for (const id of Object.keys(tas)) tas[id].value = plantillaConjunto(id, d.modalidad, { servicio: d.svc, historia: d.historia.id });
          salida.replaceChildren(el("p", { textContent: "Te dejé una plantilla en cada cuadro. Ajústalas a tu cambio y pulsa Validar." }));
        } })));
  }

  function revisarInstr() {
    const conj = Object.fromEntries(Object.entries(d.tas).map(([k, t]) => [k, t.value]));
    const v = validarConjuntos(conj, d.modalidad, { servicio: d.svc, criticidad: d.criticidad }, flujo);
    if (!v.ok) {
      d.salida.replaceChildren(el("p", { textContent: "🛑 Aún no pasan la revisión. Corrige y valida de nuevo:" }),
        v.faltan.length ? lista(v.faltan.map((f) => `Falta: ${f}`)) : "", v.bloqueos.length ? lista(v.bloqueos) : "", v.avisos.length ? lista(v.avisos.map((a) => `Aviso: ${a}`)) : "");
      return;
    }
    d.conj = conj; d.conjVal = v; d.instrOk = true;
    d.salida.replaceChildren(el("p", { textContent: `✅ Los cuatro conjuntos son válidos (${v.lista.map((x) => x.pasos).join(" + ")} pasos).` }), v.avisos.length ? lista(v.avisos.map((a) => `Aviso: ${a}`)) : "");
    st = "guia";
    say("bot", p("El líder técnico recibe tus instrucciones validadas."), opciones(opcion("Continuar", () => mostrarEstado("revisiones"))));
  }

  function fin() {
    st = "fin";
    say("bot", el("h3", { textContent: `${d.key} completado` }),
      p("Recorriste el flujo completo del OCD hasta el cierre."),
      detalle("Ver lo que hicimos", p("Grupos de red, historia en Jira, modalidad, datos, instrucciones validadas, revisiones, congelamiento, gestión de pase con su fecha, ejecución, ratificación y cierre."), DOC_FLUJO),
      opciones(opcion("Abrir mi OCD en Jira con estos datos", () => ir({ usuario: d.u.id, servicio: d.svc, tipo: d.tipo, fecha: d.fecha, historia: d.historia.id, modalidad: d.modalidad, historiaObj: { id: d.historia.id, servicio: d.svc, titulo: d.historia.titulo, estado: d.historia.estado }, gruposExtra: d.extra ?? [], perfil: d.perfil, instruccionesConj: d.conj ?? null })),
        opcion("Crear otro OCD", () => iniciarCrear()), opcion("Terminar", () => { reiniciar(); say("bot", p("¡Éxito con tu OCD! Si te trabas, pregúntame lo que necesites.")); })));
  }

  /* ---------- Preguntas sobre el flujo, las modalidades y los roles ---------- */
  function explicarFlujo() {
    const principales = Object.entries(flujo.estados).filter(([, e]) => !e.rama).sort((a, b) => a[1].orden - b[1].orden);
    const ramas = Object.values(flujo.estados).filter((e) => e.rama);
    say("bot", p(`El OCD recorre ${principales.length} estados y cada uno lo mueve un actor distinto, más ${ramas.length} ramas si algo falla.`),
      detalle("Ver los estados y quién los mueve", [el("ol", {}, principales.map(([, e]) => el("li", { textContent: `${e.nombre} · lo mueve ${rolNombre(e.actor, flujo)}. ${e.descripcion}` }))), p(`Ramas, solo si algo falla: ${ramas.map((e) => e.nombre).join(" · ")}.`)], DOC_FLUJO),
      opciones(opcion("¿Qué me toca a mí?", preguntarRol), opcion("Quiero crear un OCD", () => iniciarCrear())));
  }

  function explicarModalidades() {
    say("bot", p("Hay cuatro modalidades de OCD. La modalidad decide quién ejecuta las instrucciones y cómo se valida cada paso."),
      el("div", { className: "mod-grid" }, Object.entries(flujo.modalidades).map(([k, m]) => el("div", { className: "mod-card" }, el("strong", { textContent: k }), p(m.descripcion),
        m.ejemplo ? detalle(`Ver un ejemplo de OCD ${k}`, [p(`${m.ejemplo.ocd} · ${m.ejemplo.servicio}: ${m.ejemplo.resumen}`), lista(m.ejemplo.pasos)], { texto: "Documentación de las modalidades", ruta: m.ejemplo.doc }) : ""))),
      opciones(opcion("Quiero crear un OCD", () => iniciarCrear())));
  }

  function preguntarRol() {
    st = "rol";
    say("bot", p("¿Con qué rol participas en el OCD?"), opciones(...Object.entries(flujo.roles).map(([id, r]) => opcion(r.nombre, () => mostrarRol(id)))));
  }

  function mostrarRol(id) {
    st = "idle"; d = {};
    const items = pendientesDeRol(id, flujo);
    say("bot", p(`Como ${rolNombre(id, flujo)} te toca mover el OCD en ${items.length} estado(s).`),
      detalle("Ver qué hacer en cada estado", lista(items.map((e) => `${e.nombre}${e.rama ? " (rama)" : ""}: ${e.queHacer}`)), DOC_FLUJO),
      p("En GitHub lo haces comentando «/ocd mover <estado>» en el Issue del OCD; el agente comprueba tu rol y los requisitos."));
  }

  function iniciarCrear() {
    pausa = null; pre = {};
    if (d.u) { const u = d.u, extra = d.extra ?? [], perfil = d.perfil; d = { modo: "crear", u, extra, perfil }; say("bot", p(`Sigo con tu matrícula ${u.matricula}.`)); perfil ? revisarDso() : pedirPerfil(); return; }
    pedirMatricula("crear");
  }

  /* ---------- Entrada de texto ---------- */
  function manejar(texto) {
    const r = interno(texto);
    if (r && pausa && st === "idle") ofrecerRetomar();
    return r;
  }

  /** Si el usuario preguntó algo en medio de su OCD, se responde y se ofrece seguir donde iba. */
  function ofrecerRetomar() {
    if (!pausa) return;
    say("bot", p("Tu OCD sigue guardado tal como lo dejaste. ¿Lo retomamos?"),
      opciones(opcion("Sí, retomar mi OCD", retomar), opcion("Descartarlo", () => { pausa = null; say("bot", p("Listo, lo descarté. Cuando quieras empezamos otro.")); })));
  }
  function retomar() {
    if (!pausa) return;
    ({ st, d } = pausa); pausa = null;
    const f = { matricula: () => pedirMatricula(d.modo ?? "crear"), perfil: pedirPerfil, hconf: pedirHistoria, fecha: pedirFecha, hora: () => pedirCampo("hora"), historia: pedirHistoria, hsvc: ayudaHistoria, modalidad: pedirModalidad, evidencias: pedirEvidencias, guia: () => mostrarEstado(d.estado),
      helpdesk: revisarDso, "crear?": despuesDeGrupos, oferta: () => { st = "idle"; ofrecer(); }, hrol: () => say("bot", p("¿Quién es el usuario que se beneficia? Es el «Como …» de la historia.")),
      hobj: () => say("bot", p("¿Qué quiere lograr? Es el «quiero …».")), hben: () => say("bot", p("¿Para qué lo quiere? Es el «para …».")),
      instr: () => say("bot", p("Seguimos con tus instrucciones: escríbelas en los cuadros de arriba y pulsa «Validar mis instrucciones».")),
      fin: () => say("bot", p("Ya habías terminado este OCD. ¿Quieres crear otro?")) }[st];
    if (f) { f(); return; }
    if (ORDEN.includes(st)) pedirCampo(st);
  }

  /** Arranca la creación del OCD usando lo que el usuario ya contó. */
  function iniciarConDatos(datos) {
    pre = { ...datos };
    reiniciar();
    if (Object.keys(pre).length) say("bot", p("Perfecto, con lo que me contaste armamos tu OCD paso a paso y me quedo atento a cada validación."));
    pedirMatricula("crear");
  }

  function interno(texto) {
    const t = String(texto ?? "").trim();
    const q = quitarAcentos(t);
    if (/^(cancelar|salir)$/.test(q) && st !== "idle") { reiniciar(); say("bot", p("Listo, lo dejamos aquí. Cuando quieras, escribe «quiero crear un OCD».")); return true; }
    /* Si el usuario cambia un dato en medio del OCD («mejor el martes», «ya probé el rollback») se actualiza y se sigue sin reiniciar. */
    if (ORDEN.includes(st) && !/[?¿]/.test(t)) {
      const x = extraerDatos(t, { servicios: Object.keys(dir.servicios), hoy: HOY });
      const cambios = ["fecha", "hora", "rollback", "tipo", "criticidad"].filter((k) => k !== st && x[k] && x[k] !== d[k]);
      if (cambios.length) { for (const k of cambios) d[k] = x[k]; say("bot", p(`Anotado: ${cambios.map((k) => `${k} ${x[k]}`).join(" · ")}. Sigo desde donde íbamos.`)); pedirCampo(st); return true; }
    }
    if (st === "idle") {
      const rol = rolDeTexto(q, flujo);
      if (/(que me toca|que sigue|que debo hacer|mi turno|que me corresponde)/.test(q) && (/\bocd\b/.test(q) || rol)) { rol ? mostrarRol(rol) : preguntarRol(); return true; }
      if (/\bocd\b/.test(q) && /\b(flujo|estados?|etapas?|ciclo|pasos)\b/.test(q) && !/(crear|crea|creo)\b/.test(q)) { explicarFlujo(); return true; }
      if (/(modalidad|automatizado|hibrido|deploygo|deploy go|tipos de ocd)/.test(q)) { explicarModalidades(); return true; }
      if (!/[?¿]/.test(t) && /\bocd\b/.test(q) && /(crear|crea|creo|armar|abrir|generar|ayud)/.test(q)) { pre = {}; iniciarCrear(); return true; }
      return false;
    }
    if (st === "rol") { const r = rolDeTexto(q, flujo); if (r) { mostrarRol(r); return true; } return salir(t); }
    if (st === "modalidad") {
      const k = Object.keys(flujo.modalidades).find((m) => q.includes(quitarAcentos(m))) ?? (/hibrid/.test(q) ? "Híbrido" : /automat/.test(q) ? "Automatizado" : null);
      if (!k) { if (esPregunta(t)) return salir(t); say("bot", p(`Elige una modalidad: ${Object.keys(flujo.modalidades).join(", ")}.`)); return true; }
      conModalidad(k); return true;
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
      say("bot", p("Usa los botones para avanzar de estado, o escribe «cancelar» para salir de la guía."));
      return true;
    }
    if (st === "perfil") {
      if (/\b(lt|lider|lideres)\b/.test(q)) { conPerfil("Líder técnico"); return true; }
      if (/\b(tm|team|developer|desarrollador|miembro)\b/.test(q)) { conPerfil("Team Member"); return true; }
      if (esPregunta(t)) return salir(t);
      say("bot", p("Dime si participas como Líder técnico (LT) o como Team Member (TM).")); return true;
    }
    if (st === "hconf") {
      if (/^(si|sí|claro|dale|ok|vale|es esta|correcta)/.test(q)) { confirmarHistoria(); return true; }
      if (/^(no|otra|buscar)/.test(q)) { pedirHistoria(); return true; }
      return salir(t);
    }
    if (st === "matricula") return conMatricula(t);
    if (st === "historia") return conHistoria(t);
    if (st === "hsvc") return conHsvc(t);
    if (st === "hrol") return conHrol(t);
    if (st === "hobj") return conHobj(t);
    if (st === "hben") return conHben(t);
    if (st === "instr") { say("bot", p("Escribe cada conjunto en su cuadro y pulsa «Validar mis instrucciones».")); return true; }
    if (st === "fecha") {
      const m = extraerDatos(t, { servicios: [], hoy: HOY }).fecha;
      const f = /sugerid|usar/.test(q) ? d.sugerida : m;
      if (!f || !fechaValida(f)) {
        if (esPregunta(t) && !m) return salir(t);
        say("bot", p("No pude leer esa fecha. Dime, por ejemplo, «el martes», «24 de noviembre» o 2026-11-24, o pulsa la sugerida.")); return true;
      }
      conFecha(f); return true;
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

  return { ofrecer, iniciar: iniciarCrear, iniciarConDatos, manejar, ofrecerRetomar, preguntarRol, explicarFlujo, explicarModalidades, pausar: () => { if (st !== "idle" && st !== "fin" && !pausa) pausa = { st, d }; st = "idle"; d = {}; fuera(); }, get pausado() { return !!pausa; }, get activo() { return st !== "idle"; } };
}
