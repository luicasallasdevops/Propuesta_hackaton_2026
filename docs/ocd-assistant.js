// Asistente conversacional del OCD (todo simulado, sin IA generativa, solo nodos DOM).
// Escenario 1: el usuario pregunta cómo crear un OCD -> el agente valida sus grupos de red de DevSecOps y, si faltan, ofrece pedirlos en Helpdesk.
// Escenario 2: el usuario pide crear un OCD -> historia (validar o crear), datos del OCD, guía interactiva y validación de instrucciones en las revisiones técnicas.
import {
  assessOcd, buscarPorMatricula, normalizarMatricula, validarEquipoOcd, proximaVentana, fechaValida, fmtFechaCorta,
  revisarGruposDevsecops, crearSolicitudHelpdesk, normalizarHistoria, validarHistoria, armarHistoria,
  validarInstrucciones, plantillaInstrucciones, revisarSolicitanteOcd, revisarHistoriaEInstrucciones, combinarSolicitante,
} from "./engine.mjs";
import { validarConjuntos, plantillaConjunto, ejecutaAutomatico, avanzaSolo, rolDeTexto, pendientesDeRol, rolNombre, transicionesDe } from "./flujo.mjs";

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

export function crearAsistenteOcd({ say, el, dir, cfg, cal, policy, incidents, historias, flujo, ir }) {
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
    pedirModalidad(); return true;
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
    pedirModalidad(); return true;
  }

  /* ---------- Modalidad del OCD ---------- */
  function pedirModalidad() {
    st = "modalidad";
    say("bot", p("¿Qué modalidad tendrá el OCD? Define quién ejecuta las instrucciones y cómo se mueve de estado."),
      lista(Object.entries(flujo.modalidades).map(([k, m]) => `${k}: ${m.descripcion}`)),
      opciones(...Object.keys(flujo.modalidades).map((k) => opcion(k, () => conModalidad(k)))));
  }
  function conModalidad(k) {
    d.modalidad = k;
    say("bot", p(`Modalidad ${k}. ${k === "Híbrido" ? "Recuerda etiquetar cada paso de las instrucciones como [AUTO] o [MANUAL]." : k === "DeployGO" ? "Los cambios de estado los moverán eventos de git (PR, tags)." : k === "Automatizado" ? "Todos los pasos deben ser automáticos ([AUTO], con workflow, pipeline o script)." : "Las instrucciones las ejecuta a mano agileOps."}`));
    pedirCampo("tipo");
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
      p(`${nombreCorto(d.u)} (${d.u.matricula}) · ${d.svc} · ${d.tipo} · modalidad ${d.modalidad} · ${d.fecha} ${d.hora} (${r.dia}) · historia ${d.historia.id}`),
      p(`Pre-validación del agente: ${r.estado}, riesgo ${r.nivel} (${r.score}/100).`),
      r.blockers.length ? el("div", {}, p("🛑 Esto bloquea el OCD:"), lista(r.blockers)) : p("✅ Sin bloqueos."),
      r.sugerida && r.blockers.length ? p(`Fecha sugerida: ${r.sugerida} (${fmtFechaCorta(r.sugerida)}).`) : "",
      p("👥 Aprobadores de este OCD:"), lista(r.aprobadores.map((a) => { const x = eq.roles.find((y) => y.rol === a.replace(/\s*\(.*\)$/, "")); return x ? `${a}: ${x.esperadoNombre}` : a; })),
      p("Ahora te guío por los estados reales del OCD. Al salir de Inicio codificación validaré tus cuatro conjuntos de instrucciones."));
    mostrarEstado("inicio");
  }

  /** Estado del flujo: quién lo mueve, qué hacer y, si aplica, quién lo ejecuta (persona, automatización o evento de git). */
  function mostrarEstado(id) {
    st = "guia"; d.estado = id;
    const e = flujo.estados[id];
    const etapa = d.r.plan.find((x) => x.id === e.etapaPlan);
    const auto = ejecutaAutomatico(id, d.modalidad, d.conjVal, flujo);
    const evento = flujo.eventosGit.filter((g) => g.desde === id).map((g) => g.descripcion);
    const total = Object.keys(flujo.estados).length;
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
    say("bot", el("h3", { textContent: `Estado ${e.orden} de ${total} · ${e.nombre}${e.rama ? " (rama: solo si algo falla)" : ""}` }),
      p(`Lo mueve: ${rolNombre(e.actor, flujo)}${etapa ? ` · ${fmtFechaCorta(etapa.fecha)}${etapa.hora ? ` ${etapa.hora}` : ""}` : ""}`),
      p(e.queHacer),
      auto && avanzaSolo(d.modalidad, flujo) ? p("⚙️ En la modalidad " + d.modalidad + " este estado se ejecuta automáticamente (simulado). Dime si salió bien o falló para ver cada camino.") : "",
      flujo.modalidades[d.modalidad]?.gitops && evento.length ? p(`🔀 DeployGO: lo mueve el evento de git «${evento.join(" / ")}».`) : "",
      id === "gestion_pase" ? el("div", {}, p("Aprobaciones del pase:"), lista(flujo.aprobadoresPase)) : "",
      d.r.blockers.length && id === "inicio" ? p("⚠️ El agente dejó el OCD en Bloqueado. Corrige lo anterior y se vuelve a evaluar al editar el ticket. Aquí seguimos para que aprendas el flujo completo.") : "",
      opciones(...botones));
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
      p(`Modalidad ${d.modalidad}. ${d.modalidad === "Híbrido" ? "Etiqueta cada paso [AUTO] o [MANUAL]. " : d.modalidad === "Manual" ? "Pasos numerados que ejecuta agileOps. " : "Todos los pasos deben ser automáticos (workflow, pipeline o script). "}Reviso pasos numerados, rollback, verificación, credenciales y comandos peligrosos.`),
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
    say("bot", el("h3", { textContent: `${d.key} completado (simulado)` }),
      p("Recorriste el flujo: grupos de red, historia, modalidad, datos, instrucciones validadas, revisiones, congelamiento, gestión de pase, ejecución, ratificación y cierre."),
      opciones(opcion("Abrir el simulador de Jira con mis datos", () => ir({ usuario: d.u.id, servicio: d.svc, tipo: d.tipo, fecha: d.fecha, historia: d.historia.id, modalidad: d.modalidad, historiaObj: { id: d.historia.id, servicio: d.svc, titulo: d.historia.titulo, estado: d.historia.estado }, gruposExtra: d.extra ?? [], instruccionesConj: d.conj ?? null })),
        opcion("Crear otro OCD", () => iniciarCrear()), opcion("Terminar", () => { reiniciar(); say("bot", p("¡Éxito con tu OCD! Si te trabas, pregúntame lo que necesites.")); })));
  }

  /* ---------- Preguntas sobre el flujo, las modalidades y los roles ---------- */
  function explicarFlujo() {
    const principales = Object.entries(flujo.estados).filter(([, e]) => !e.rama).sort((a, b) => a[1].orden - b[1].orden);
    const ramas = Object.values(flujo.estados).filter((e) => e.rama);
    say("bot", p("El OCD recorre estos estados, y cada uno lo mueve un actor distinto:"),
      el("ol", {}, principales.map(([, e]) => el("li", { textContent: `${e.nombre} · lo mueve ${rolNombre(e.actor, flujo)}. ${e.descripcion}` }))),
      p(`Ramas, solo si algo falla: ${ramas.map((e) => e.nombre).join(" · ")}.`),
      opciones(opcion("¿Qué me toca a mí?", preguntarRol), opcion("Quiero crear un OCD", () => iniciarCrear())));
  }

  function explicarModalidades() {
    say("bot", p("Hay cuatro modalidades de OCD:"), lista(Object.entries(flujo.modalidades).map(([k, m]) => `${k}: ${m.descripcion}`)),
      p("La modalidad decide quién ejecuta las instrucciones y cómo se valida cada paso."), opciones(opcion("Quiero crear un OCD", () => iniciarCrear())));
  }

  function preguntarRol() {
    st = "rol";
    say("bot", p("¿Con qué rol participas en el OCD?"), opciones(...Object.entries(flujo.roles).map(([id, r]) => opcion(r.nombre, () => mostrarRol(id)))));
  }

  function mostrarRol(id) {
    reiniciar();
    const items = pendientesDeRol(id, flujo);
    say("bot", p(`Como ${rolNombre(id, flujo)}, te toca mover el OCD en estos estados:`),
      lista(items.map((e) => `${e.nombre}${e.rama ? " (rama)" : ""}: ${e.queHacer}`)),
      p("En GitHub lo haces comentando «/ocd mover <estado>» en el Issue del OCD; el agente comprueba que tengas el rol y que se cumplan los requisitos."));
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
      const rol = rolDeTexto(q, flujo);
      if (/(que me toca|que sigue|que debo hacer|mi turno|que me corresponde)/.test(q) && (/\bocd\b/.test(q) || rol)) { rol ? mostrarRol(rol) : preguntarRol(); return true; }
      if (/\bocd\b/.test(q) && /\b(flujo|estados?|etapas?|ciclo|pasos)\b/.test(q) && !/(crear|crea|creo)\b/.test(q)) { explicarFlujo(); return true; }
      if (/(modalidad|automatizado|hibrido|deploygo|deploy go|tipos de ocd)/.test(q)) { explicarModalidades(); return true; }
      if (!/[?¿]/.test(t) && /\bocd\b/.test(q) && /(crear|crea|creo|armar|abrir|generar|ayud)/.test(q)) { iniciarCrear(); return true; }
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
    if (st === "matricula") return conMatricula(t);
    if (st === "historia") return conHistoria(t);
    if (st === "hsvc") return conHsvc(t);
    if (st === "hrol") return conHrol(t);
    if (st === "hobj") return conHobj(t);
    if (st === "hben") return conHben(t);
    if (st === "instr") { say("bot", p("Escribe cada conjunto en su cuadro y pulsa «Validar mis instrucciones».")); return true; }
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
