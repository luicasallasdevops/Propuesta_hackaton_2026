// Simulador de creación de un OCD "estilo Jira": valida grupos de red, aprobadores, calendario y riesgo con el agente.
// En la POC el motor corre en GitHub; en producción el mismo agente leería el ticket de Jira. Solo nodos DOM y textContent.
import { assessOcd, validarEquipoOcd, fmtFechaCorta, revisarGruposDevsecops, validarHistoria } from "./engine.mjs";
import { validarConjuntos, plantillaConjunto, ejecutaAutomatico, cadenaAutomatica, puedeMover, rolNombre, transicionesDe } from "./flujo.mjs";

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const ICON = { ok: "✅", falta: "⬜", incorrecto: "⚠️" };
const LOZENGE = { "Solicitado": "z1", "Bloqueado": "z2", "Listo para aprobaciones": "z3", "Aprobado": "z4", "En producción": "z5" };

export function montarJira({ cfg, cal, policy, incidents, dir, hoy, historias, flujo }) {
  let contador = 2100;
  const servicios = Object.keys(dir.servicios);
  const sel = (name, opts, val) => { const s = el("select", { name }, opts.map((o) => (Array.isArray(o) ? el("option", { value: o[0], textContent: o[1] }) : el("option", { textContent: o })))); if (val) s.value = val; return s; };
  const campo = (rotulo, control, extra = "") => el("label", {}, rotulo, extra ? el("small", { className: "hint", textContent: ` ${extra}` }) : "", control);

  const quien = sel("usuario", Object.entries(dir.usuarios).map(([k, u]) => [k, `${u.nombre} · ${u.matricula} · ${u.detalle}`]), "nueva");
  const form = el("form", { className: "card jira", id: "jira-form" });
  const roles = ["Líder técnico", "Product Owner", "Seguridad", "Change Management"];
  const opcionesRol = (rol) => [["", "— elige —"], ...Object.entries(dir.personas).filter(([, p]) => p.rol === rol).map(([id, p]) => [id, p.nombre])];
  const aprob = el("div", { className: "row2" }, roles.map((r) => campo(r, sel(`ap_${r}`, opcionesRol(r)))));
  const checks = el("div", { className: "chk" });
  for (const [k, c] of Object.entries(policy.controles)) checks.append(el("label", {}, el("input", { type: "checkbox", name: k, checked: true }), c.etiqueta));
  for (const [k, c] of Object.entries(cfg.controles)) checks.append(el("label", { className: "ocd-extra" }, el("input", { type: "checkbox", name: `ocd_${k}`, checked: true }), c.etiqueta));
  const gruposBox = el("div", { className: "grupos" });
  const histSel = el("select", { name: "historia" });
  const llenarHistorias = (valor = "") => {
    const svc = form.elements.servicio?.value;
    histSel.replaceChildren(el("option", { value: "", textContent: "— elige —" }), ...historias.filter((h) => !svc || h.servicio === svc).map((h) => el("option", { value: h.id, textContent: `${h.id} · ${h.titulo}` })));
    histSel.value = [...histSel.options].some((o) => o.value === valor) ? valor : "";
  };
  const instrEls = Object.fromEntries(Object.entries(flujo.conjuntos).map(([id]) => [id, el("textarea", { name: `ins_${id}`, rows: 4, maxLength: 4000, placeholder: "1. …\n2. …\nEn Híbrido etiqueta cada paso [AUTO] o [MANUAL]. Se validan al pasar a Revisiones técnicas." })]));
  const usarPlantilla = el("button", { type: "button", className: "btn ghost chico", textContent: "Usar plantillas de instrucciones" });
  const auto = el("button", { type: "button", className: "btn ghost", textContent: "✨ Autocompletar con lo que sugiere el agente" });
  const crear = el("button", { type: "submit", textContent: "Crear OCD" });

  form.append(
    el("div", { className: "jira-bar" }, el("strong", { textContent: "Jira" }), el("span", { textContent: "Crear incidencia" })),
    el("div", { className: "jira-meta" }, el("span", { className: "tag", textContent: "Proyecto: OCD" }), el("span", { className: "tag", textContent: "Tipo: Pase a Producción" })),
    campo("Solicitante", quien),
    campo("Resumen", el("input", { name: "resumen", value: "Ajuste en el servicio de pagos", maxLength: 120, required: true })),
    el("div", { className: "row" }, campo("Servicio", sel("servicio", servicios, "pagos-api")), campo("Tipo de cambio", sel("tipo", Object.keys(cfg.tipos), "Normal"))),
    el("div", { className: "row" }, campo("Criticidad", sel("criticidad", ["Alta", "Media", "Baja"], "Alta")), campo("Tamaño", sel("tamano", ["Pequeño", "Mediano", "Grande"], "Pequeño"))),
    el("div", { className: "row" }, campo("Fecha de ejecución", el("input", { name: "fecha", type: "date", value: "2026-11-24", required: true }), "(noche mar a jue)"), campo("Hora de inicio", el("input", { name: "hora", type: "time", value: "22:00", required: true }))),
    campo("Plan de rollback", sel("rollback", ["Sí, probado", "Sí, sin probar", "No"], "Sí, probado")),
    campo("Modalidad", sel("modalidad", Object.keys(flujo.modalidades), "Híbrido"), "(quién ejecuta las instrucciones)"),
    campo("Historia asociada", histSel, "(la HU que origina el cambio)"),
    el("h3", { textContent: "🌐 Grupos de red" }), gruposBox,
    el("h3", { textContent: "👥 Aprobadores" }), aprob, auto,
    el("fieldset", {}, el("legend", { textContent: "Evidencias y requisitos" }), checks),
    el("fieldset", {}, el("legend", { textContent: "Instrucciones (cuatro conjuntos)" }),
      Object.entries(flujo.conjuntos).map(([id, c]) => campo(c.etiqueta, instrEls[id], id === "despliegue" ? "(opcional al crear; se validan al pasar a Revisiones técnicas)" : "")), usarPlantilla),
    crear);

  const panel = el("div", { className: "card asistente", ariaLive: "polite" });
  const ticket = el("div", { className: "card ticket", hidden: true });
  const estado = { creado: null };

  const leer = () => {
    const f = new FormData(form);
    const elegidos = Object.fromEntries(roles.map((r) => [r, String(f.get(`ap_${r}`) || "")]));
    const o = {
      change: { servicio: String(f.get("servicio")), tipo: String(f.get("tipo")), criticidad: String(f.get("criticidad")), tamano: String(f.get("tamano")), rollback: String(f.get("rollback")),
        checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, f.get(k) === "on"])) },
      fecha: String(f.get("fecha")), hora: String(f.get("hora")),
      ocdChecks: Object.fromEntries(Object.keys(cfg.controles).map((k) => [k, f.get(`ocd_${k}`) === "on"])),
    };
    const usuarioId = String(f.get("usuario"));
    const eq = validarEquipoOcd({ servicio: o.change.servicio, usuarioId, elegidos, tipo: o.change.tipo }, dir, cfg);
    const dso = revisarGruposDevsecops(dir.usuarios[usuarioId], dir);
    const hist = validarHistoria({ historia: String(f.get("historia") || ""), servicio: o.change.servicio }, historias);
    const modalidad = String(f.get("modalidad") || "Manual");
    const conj = Object.fromEntries(Object.keys(flujo.conjuntos).map((k) => [k, String(f.get(`ins_${k}`) || "")]));
    const cv = validarConjuntos(conj, modalidad, { servicio: o.change.servicio, criticidad: o.change.criticidad }, flujo);
    const ins = cv.lista.some((x) => !x.vacio) ? cv : null;
    return { f, o, eq, elegidos, dso, hist, ins, cv, modalidad, historia: String(f.get("historia") || ""), r: assessOcd(o, incidents, policy, cfg, cal, hoy) };
  };

  const fila = (icono, txt, cls = "") => el("li", { className: cls }, el("span", { textContent: icono, ariaHidden: "true" }), el("span", { textContent: ` ${txt}` }));
  function pintar() {
    const { o, eq, r, dso, hist, ins } = leer();
    const gr = [...dso.grupos.map((g) => fila(g.tiene ? "✅" : "❌", `${g.id} (DevSecOps) · ${g.nombre}`, g.tiene ? "" : "mal")), ...eq.grupos.map((g) => fila(g.tiene ? "✅" : "❌", `${g.id} (servicio) · ${g.nombre}`, g.tiene ? "" : "mal"))];
    gruposBox.replaceChildren(el("ul", { className: "lst" }, gr));
    const rolesLis = eq.roles.map((x) => fila(ICON[x.estado], x.estado === "ok" ? `${x.rol}: ${x.elegidoNombre}` : x.estado === "falta" ? `${x.rol}: sin elegir · en este servicio es ${x.esperadoNombre}` : `${x.rol}: ${x.elegidoNombre} no corresponde · es ${x.esperadoNombre}`, x.estado === "ok" ? "" : "mal"));
    const pasos = [];
    const faltanGrupos = [...dso.faltan, ...eq.grupos.filter((g) => !g.tiene)];
    if (!hist.ok) pasos.push(`${hist.motivo}. Elige la historia del cambio; si no tienes una, pídele al chat «quiero crear un OCD» y te ayuda a crearla.`);
    if (ins && ins.bloqueos.length) pasos.push(`Corrige las instrucciones: ${ins.bloqueos[0]}.`);
    if (faltanGrupos.length) pasos.push(`Pide los grupos de red: ${faltanGrupos.map((g) => g.id).join(", ")}. ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}. ${dir.solicitudRed.ayuda}`);
    if (eq.roles.some((x) => x.estado !== "ok")) pasos.push("Elige a los aprobadores correctos del servicio. Puedes usar el botón Autocompletar para ver quiénes son.");
    if (r.blockers.length) pasos.push(`Resuelve los bloqueos del agente: ${r.blockers.slice(0, 2).join("; ")}.`);
    if (r.sugerida && r.blockers.some((b) => /ventana|Fuera|Congelamiento|Anticipación|feriado|futura/i.test(b))) pasos.push(`Prueba la noche del ${r.sugerida} (${fmtFechaCorta(r.sugerida)}).`);
    const listo = !pasos.length;
    const col = r.estado === "Bloqueado" || !eq.completo ? "bad" : r.score < 30 ? "ok" : "warn";
    panel.replaceChildren(
      el("h2", { textContent: "🤖 Asistente OCD" }),
      el("p", { className: "muted", textContent: "Revisa tu ticket mientras lo llenas. Aprende qué necesita un OCD antes de crearlo." }),
      el("h3", { textContent: "1 · Grupos de red" }), el("p", { textContent: eq.grupos.length ? (faltanGrupos.length ? `Te faltan ${faltanGrupos.length} de ${eq.grupos.length + dso.grupos.length} (DevSecOps y del servicio).` : "Tienes todos los de DevSecOps y los que exige el servicio.") : "Servicio desconocido." }),
      el("h3", { textContent: "2 · Aprobadores" }), el("ul", { className: "lst" }, rolesLis),
      el("h3", { textContent: "3 · Historia e instrucciones" }),
      el("ul", { className: "lst" }, [fila(hist.ok ? "✅" : "⬜", hist.ok ? `Historia ${hist.id}: ${hist.historia.titulo}` : hist.motivo, hist.ok ? "" : "mal"),
        ins ? fila(ins.bloqueos.length ? "🛑" : ins.ok ? "✅" : "ℹ️", ins.bloqueos.length ? ins.bloqueos[0] : ins.ok ? `Los cuatro conjuntos son válidos (${ins.lista.reduce((n, x) => n + x.pasos, 0)} pasos)` : `Faltan por escribir: ${ins.faltan.join(", ")}`, ins.bloqueos.length ? "mal" : "") : fila("ℹ️", "Instrucciones pendientes: se validan al pasar a Revisiones técnicas")]),
      el("h3", { textContent: "4 · Calendario y riesgo" }),
      el("p", {}, el("span", { className: `pill ${col}`, textContent: !eq.completo && r.estado !== "Bloqueado" ? "Faltan datos del equipo" : r.estado }), ` Riesgo ${r.nivel} (${r.score}/100)`),
      r.blockers.length ? el("ul", { className: "lst" }, r.blockers.slice(0, 4).map((b) => fila("🛑", b, "mal"))) : "",
      r.advertencias.length ? el("ul", { className: "lst" }, r.advertencias.slice(0, 2).map((b) => fila("⚠️", b))) : "",
      el("h3", { textContent: listo ? "✅ Todo listo para crear el OCD" : "👉 Siguiente paso" }),
      listo ? el("p", { textContent: "Pulsa Crear OCD. El agente publicará el calendario y pedirá las aprobaciones." }) : el("ol", { className: "lst" }, pasos.map((p) => el("li", { textContent: p }))));
  }

  auto.addEventListener("click", () => {
    const svc = dir.servicios[form.elements.servicio.value];
    for (const r of roles) form.elements[`ap_${r}`].value = svc?.roles[r] ?? "";
    pintar();
  });
  usarPlantilla.addEventListener("click", () => {
    for (const id of Object.keys(instrEls)) instrEls[id].value = plantillaConjunto(id, form.elements.modalidad.value, { servicio: form.elements.servicio.value, historia: histSel.value || "HU-0000" });
    pintar();
  });
  form.elements.servicio.addEventListener("change", () => llenarHistorias(histSel.value));
  form.addEventListener("input", pintar);
  form.addEventListener("change", pintar);

  /* ---------- Ticket creado ---------- */
  function pintarTicket() {
    const t = estado.creado;
    if (!t) return;
    const pendientes = Object.values(t.aprobaciones).filter((v) => v === "pendiente").length;
    let col = t.col;
    if (col !== "En producción") col = t.bloqueado ? "Bloqueado" : pendientes ? "Listo para aprobaciones" : "Aprobado";
    t.col = col;
    ticket.hidden = false;
    ticket.replaceChildren(
      el("div", { className: "jira-bar" }, el("strong", { textContent: `${t.key} · ${t.resumen}` }), el("span", { className: `lz ${LOZENGE[col]}`, textContent: col })),
      el("p", { className: "muted", textContent: `${t.servicio} · ${t.historia || "sin historia"} · ${t.tipo} · ${fmtFechaCorta(t.fecha)} ${t.hora} · riesgo ${t.nivel} (${t.score}/100) · creado por ${t.autor}` }),
      el("h3", { textContent: "🤖 Comentario del agente OCD" }),
      t.bloqueado ? el("ul", { className: "lst" }, t.motivos.map((m) => fila("🛑", m, "mal"))) : el("p", { textContent: "Sin bloqueos. Se solicitaron las aprobaciones y se calculó el calendario." }),
      t.plan.length ? el("ol", { className: "tl" }, t.plan.map((p) => el("li", {}, el("span", { className: "tl-d", textContent: `${fmtFechaCorta(p.fecha)}${p.hora ? ` ${p.hora}` : ""}` }), el("span", { className: "tl-t" }, el("strong", { textContent: p.nombre }), el("small", { textContent: ` · ${p.responsable}` }))))) : "",
      el("h3", { textContent: "👥 Aprobaciones" }),
      el("ul", { className: "lst" }, Object.entries(t.aprobaciones).map(([k, v]) => el("li", {},
        el("span", { textContent: `${v === "ok" ? "✅" : v === "informado" ? "ℹ️" : "⏳"} ${k}: ${t.nombres[k] || "por asignar"} ` }),
        v === "pendiente" ? el("button", { type: "button", className: "btn ghost chico", disabled: t.bloqueado, textContent: "Marcar como aprobada", onclick: () => { t.aprobaciones[k] = "ok"; pintarTicket(); } }) : ""))),
      panelFlujo(t),
      el("div", { className: "acts" },
        el("button", { type: "button", className: "btn ghost", textContent: "✏️ Editar y corregir", onclick: () => form.scrollIntoView({ behavior: "smooth", block: "start" }) }),
        el("button", { type: "button", className: "btn", disabled: col !== "Aprobado", textContent: "🚀 Ejecutar en la ventana", onclick: () => { t.col = "En producción"; pintarTicket(); } })),
      t.bloqueado ? el("p", { className: "muted", textContent: "Corrige el formulario y pulsa Crear OCD otra vez: el agente reevalúa y la tarjeta se mueve sola." }) : col === "En producción" ? el("p", { textContent: "🎉 OCD ejecutado. Verifica 30 minutos y ciérralo con la evidencia." }) : "");
  }

  /** Estados reales del OCD: cada transición exige el rol del actor y que se cumplan los requisitos. */
  function panelFlujo(t) {
    const e = flujo.estados[t.flujo];
    const rolSel = sel("rol", Object.entries(flujo.roles).map(([id, r]) => [id, r.nombre]), t.rolActuando || e.actor);
    rolSel.addEventListener("change", () => { t.rolActuando = rolSel.value; });
    const ctx = { conjuntosVal: t.conjuntosVal, bloqueado: t.bloqueado };
    const auto = ejecutaAutomatico(t.flujo, t.modalidad, t.conjuntosVal, flujo);
    const mover = (hacia) => {
      const rol = rolSel.value; t.rolActuando = rol;
      const v = puedeMover({ desde: t.flujo, hacia, roles: [rol], ctx, flujo, modalidad: t.modalidad });
      if (!v.ok) { t.mensajeFlujo = `⛔ ${v.motivo}`; pintarTicket(); return; }
      t.flujo = hacia; t.mensajeFlujo = `✅ Movido a «${flujo.estados[hacia].nombre}» por ${rolNombre(rol, flujo)}.`;
      for (const c of cadenaAutomatica(hacia, t.modalidad, t.conjuntosVal, flujo)) { t.flujo = c.a; t.mensajeFlujo += ` ⚙️ Automático: ${flujo.estados[c.de].nombre} → ${flujo.estados[c.a].nombre}.`; }
      t.rolActuando = flujo.estados[t.flujo].actor;
      pintarTicket();
    };
    const trans = transicionesDe(flujo, t.flujo);
    return el("div", { className: "flujo" },
      el("h3", { textContent: "🧭 Flujo del OCD" }),
      el("p", {}, el("strong", { textContent: `${e.nombre} (${e.orden} de ${Object.keys(flujo.estados).length})` }), ` · modalidad ${t.modalidad} · lo mueve ${rolNombre(e.actor, flujo)}${auto ? " (automático)" : ""}`),
      el("p", { className: "muted", textContent: e.queHacer }),
      el("label", {}, "Actuar como ", rolSel),
      el("div", { className: "acts" }, trans.map((x) => el("button", { type: "button", className: x.tipo === "avance" ? "btn chico" : "btn ghost chico", textContent: `${x.tipo === "falla" ? "Falló → " : x.tipo === "devolver" ? "Devolver → " : "→ "}${flujo.estados[x.a].nombre}`, onclick: () => mover(x.a) }))),
      t.mensajeFlujo ? el("p", { role: "status", textContent: t.mensajeFlujo }) : "");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { o, eq, r, elegidos, f } = leer();
    const { dso, hist, ins, historia, cv, modalidad } = leer();
    const motivos = [...dso.faltan.map((g) => `Falta el grupo de DevSecOps ${g.id}`), ...eq.mensajes, ...r.blockers, ...(hist.ok ? [] : [hist.motivo]), ...cv.bloqueos.map((b) => `Instrucciones: ${b}`)];
    estado.creado = {
      modalidad, conjuntosVal: cv, flujo: "inicio", mensajeFlujo: "",
      key: `OCD-${++contador}`, resumen: String(f.get("resumen")).slice(0, 120), servicio: o.change.servicio, tipo: o.change.tipo, fecha: o.fecha, hora: o.hora, historia,
      nivel: r.nivel, score: r.score, autor: dir.usuarios[String(f.get("usuario"))].nombre, bloqueado: motivos.length > 0, motivos, plan: r.plan,
      aprobaciones: Object.fromEntries(r.aprobadores.map((a) => [a, /informado|posteriori/i.test(a) ? "informado" : "pendiente"])),
      nombres: Object.fromEntries(Object.entries(elegidos).map(([k, v]) => [k, dir.personas[v]?.nombre ?? ""])), col: "",
    };
    // Los nombres de aprobadores "(a posteriori)" o "(informado)" se muestran con su rol base.
    estado.creado.nombres = new Proxy(estado.creado.nombres, { get: (t, k) => t[String(k).replace(/\s*\(.*\)$/, "")] ?? "" });
    pintarTicket();
    ticket.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // El asistente del chat puede dejar el formulario cargado con lo que el usuario ya contestó.
  document.addEventListener("ocd:prefill", (e) => {
    const x = e.detail || {};
    for (const k of ["usuario", "servicio", "tipo", "fecha"]) if (x[k]) form.elements[k].value = x[k];
    if (x.historiaObj && !historias.some((h) => h.id === x.historiaObj.id)) historias.push(x.historiaObj);
    if (x.usuario && Array.isArray(x.gruposExtra) && dir.usuarios[x.usuario]) dir.usuarios[x.usuario].gruposDevsecops = [...new Set([...(dir.usuarios[x.usuario].gruposDevsecops ?? []), ...x.gruposExtra])];
    llenarHistorias(x.historia);
    if (x.modalidad && flujo.modalidades[x.modalidad]) form.elements.modalidad.value = x.modalidad;
    if (x.instruccionesConj) for (const [k, v] of Object.entries(x.instruccionesConj)) if (instrEls[k]) instrEls[k].value = v;
    auto.click();
  });

  llenarHistorias();
  pintar();
  return el("div", { id: "jira-sim" },
    el("div", { className: "card jira-intro" },
      el("p", { className: "eyebrow2", textContent: "🎫 Crea tu OCD en Jira" }),
      el("p", { textContent: "Así se crea un OCD en Jira. Elige quién eres: con el perfil de Valentina (nueva en el equipo) el asistente te muestra qué te falta; con el de Mateo verás el camino sin tropiezos. El agente revisa el ticket y te guía en cada paso." })),
    el("div", { className: "grid2" }, form, panel),
    ticket);
}
