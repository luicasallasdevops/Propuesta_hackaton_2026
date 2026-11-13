// Motor compartido (navegador y Node, sin dependencias).
// Recuperación de conocimiento, validación del ticket y puntaje de riesgo.

const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const STOP = new Set("de la el los las un una y o en a que por para con del al es se mi como puedo debo hay".split(" "));
export const tokenize = (s) => fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));

/** Divide los documentos Markdown en secciones (## título). */
export function splitSections(docs) {
  const out = [];
  for (const [id, md] of Object.entries(docs)) {
    const title = (md.match(/^# (.+)$/m) || [, id])[1];
    for (const part of md.split(/^## /m).slice(1)) {
      const [head, ...rest] = part.split("\n");
      out.push({ doc: id, docTitle: title, heading: head.trim(), text: rest.join("\n").trim() });
    }
  }
  return out;
}

/** Búsqueda tipo BM25 simplificada. Devuelve las mejores secciones con su puntaje. */
export function search(sections, query, k = 3) {
  const q = tokenize(query);
  if (!q.length) return [];
  const docs = sections.map((s) => tokenize(`${s.heading} ${s.heading} ${s.text}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / (docs.length || 1);
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const scored = sections.map((s, i) => {
    const d = docs[i];
    let score = 0;
    for (const t of q) {
      const tf = d.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (docs.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.length / avg)));
    }
    return { ...s, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Lee el cuerpo de un Issue Form: "### Etiqueta\n\nvalor". */
export function parseIssueForm(body) {
  const fields = {};
  for (const block of String(body ?? "").split(/^### /m).slice(1)) {
    const [label, ...rest] = block.split("\n");
    fields[label.trim()] = rest.join("\n").trim();
  }
  return fields;
}

/** Convierte "- [x] texto" en { texto: true|false }. */
export function parseChecklist(value) {
  const res = {};
  for (const m of String(value ?? "").matchAll(/^- \[([ xX])\] (.+)$/gm)) res[m[2].trim()] = m[1] !== " ";
  return res;
}

const NO_RESPONSE = "_No response_";
const clean = (v) => (v && v !== NO_RESPONSE ? v.trim() : "");

/** Cambio normalizado a partir de los campos del formulario. */
export function changeFromForm(fields, policy) {
  const marks = parseChecklist(fields["Evidencias y controles"]);
  const checks = {};
  for (const [key, c] of Object.entries(policy.controles)) checks[key] = marks[c.etiqueta] === true;
  return {
    servicio: clean(fields["Servicio"]).slice(0, 80),
    tipo: clean(fields["Tipo de cambio"]),
    criticidad: clean(fields["Criticidad del servicio"]),
    dia: clean(fields["Día de despliegue"]),
    rollback: clean(fields["Plan de rollback"]),
    checks,
  };
}

const levelFor = (policy, score) => policy.niveles.find((n) => score <= n.hasta) ?? policy.niveles.at(-1);
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;

/** Evalúa el cambio: puntaje 0-100, hallazgos, bloqueos, aprobaciones y acciones preventivas. */
export function assess(change, incidents, policy, today = new Date()) {
  const factors = [];
  const add = (label, pts) => { if (pts > 0) factors.push({ label, pts }); };

  add(`Criticidad ${change.criticidad}`, policy.criticidad[change.criticidad] ?? 0);
  add(`Rollback: ${change.rollback}`, policy.rollback[change.rollback] ?? 0);
  add(`Despliegue en ${change.dia}`, policy.diasRiesgo[change.dia] ?? 0);

  const blockers = [];
  const missing = [];
  for (const [key, c] of Object.entries(policy.controles)) {
    if (change.checks[key]) continue;
    missing.push(c.etiqueta);
    add(`Falta: ${c.etiqueta}`, c.peso);
    if (c.bloquea) blockers.push(c.etiqueta);
  }
  if (change.rollback === "No") blockers.push("Plan de rollback definido");

  const h = policy.historial;
  const similar = incidents
    .filter((i) => i.servicio === change.servicio && daysBetween(today, i.fecha) <= h.ventanaDias)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  add(`${similar.length} incidente(s) recientes en ${change.servicio}`, Math.min(similar.length * h.puntosPorIncidente, h.maximo));

  const score = Math.min(100, factors.reduce((a, f) => a + f.pts, 0));
  const nivel = levelFor(policy, score);

  // Acciones preventivas: causas históricas que coinciden con las condiciones actuales.
  const active = new Set();
  if (change.rollback !== "Sí, probado") active.add("sin-rollback");
  if (!change.checks.sca) active.add("dependencia-vulnerable");
  if (!change.checks.monitoreo) active.add("sin-monitoreo");
  if (!change.checks.red) active.add("red-no-solicitada");
  if (!change.checks.secretos) active.add("secreto-expuesto");
  const related = incidents.filter((i) => active.has(i.causa) && (i.servicio === change.servicio || similar.some((s) => s.causa === i.causa)));
  const causes = [...new Set([...active].filter((c) => incidents.some((i) => i.causa === c)))];
  const actions = causes.map((c) => policy.recomendaciones[c]).filter(Boolean);
  if (policy.diasRiesgo[change.dia]) actions.push(`Mover el despliegue a martes-jueves (ventana 22:00-04:00).`);

  return {
    score,
    nivel: nivel.nivel,
    estado: blockers.length ? "Bloqueado" : "Listo para aprobaciones",
    blockers: [...new Set(blockers)],
    missing,
    factors: factors.sort((a, b) => b.pts - a.pts),
    approvals: nivel.aprobaciones,
    similar,
    related: related.filter((i) => !similar.includes(i)),
    actions: [...new Set(actions)],
  };
}

export const esc = (s) => String(s).replace(/@/g, "@​").replace(/[<>]/g, "");

/** Informe en Markdown para publicar en el Issue. */
export function renderReport(change, r, policy) {
  const icon = r.estado === "Bloqueado" ? "🛑" : "✅";
  const L = [];
  L.push(`## ${icon} Evaluación previa al pase: ${esc(change.servicio || "sin servicio")}`);
  L.push(`**Estado:** ${r.estado} · **Riesgo:** ${r.nivel} (${r.score}/100) · política \`${policy.version}\``, "");
  if (r.blockers.length) L.push("### Bloqueos", ...r.blockers.map((b) => `- 🛑 ${b}`), "");
  if (r.actions.length) L.push("### Acciones preventivas recomendadas", ...r.actions.map((a, i) => `${i + 1}. ${a}`), "");
  L.push("### Aprobaciones requeridas", ...r.approvals.map((a) => `- [ ] ${a}`), "");
  L.push("### Por qué este puntaje", "| Factor | Puntos |", "|---|---|", ...r.factors.map((f) => `| ${esc(f.label)} | +${f.pts} |`), "");
  if (r.similar.length) L.push("### Incidentes recientes del mismo servicio", ...r.similar.map((i) => `- **${i.id}** (${i.fecha}, ${i.severidad}): ${i.resumen}`), "");
  if (r.related.length) L.push("### Incidentes de otros servicios con la misma causa", ...r.related.map((i) => `- **${i.id}** (${i.servicio}): ${i.accion}`), "");
  L.push("_Informe generado por el agente de pre-validación La decisión final es del squad y de las aprobaciones indicadas._");
  return L.join("\n");
}

/* ---------- Pase OCD: calendario, aprobadores y plan de fechas ---------- */

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const toDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * 864e5));
/** Día de la semana en español para una fecha AAAA-MM-DD ("" si es inválida). */
export const diaDe = (s) => { const d = toDate(s); return d ? DIAS[d.getUTCDay()] : ""; };
/** "Mar 24/11": día abreviado y fecha corta, para mostrar. */
export const fmtFechaCorta = (s) => { const d = diaDe(s); return d ? `${d.slice(0, 3)} ${s.slice(8)}/${s.slice(5, 7)}` : "—"; };
/** Fecha real del calendario y dentro de un rango sensato (2000-2099), para que un dato extremo no rompa los cálculos. */
export const fechaValida = (s) => toDate(s) !== null && s >= "2000-01-01" && s <= "2099-12-31";
export const feriadoDe = (s, cfg) => cfg.feriados.find((f) => f.fecha === s);
export const congelamientoDe = (s, cfg) => cfg.congelamientos.find((c) => s >= c.desde && s <= c.hasta);
export function esHabil(s, cfg) {
  const w = toDate(s).getUTCDay();
  return w > 0 && w < 6 && !feriadoDe(s, cfg);
}
/** Suma (o resta) días hábiles: sin fines de semana ni feriados. */
export function sumarHabiles(s, n, cfg) {
  let d = s, left = Math.abs(n);
  while (left > 0) { d = addDays(d, n < 0 ? -1 : 1); if (esHabil(d, cfg)) left--; }
  return d;
}
const ultimaSesionCab = (limite, cfg) => {
  let d = limite;
  for (let i = 0; i < 14; i++, d = addDays(d, -1)) if (cfg.cab.dias.includes(diaDe(d)) && esHabil(d, cfg)) return d;
  return limite;
};
const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
const enVentana = (h, cfg) => h >= cfg.ventana.horaInicio || h <= cfg.ventana.horaFin;

/** Fechas de cada etapa del OCD, calculadas hacia atrás desde la ejecución. */
export function planOcd(tipo, ejecucion, cfg, hora = cfg.ventana.horaInicio) {
  const E = cfg.etapas;
  const paso = (id, fecha, extra = {}) => ({ id, fecha, dia: diaDe(fecha), ...E[id], ...extra });
  if (tipo === "Emergencia") {
    const luego = sumarHabiles(ejecucion, 1, cfg);
    return [paso("crear", ejecucion), paso("agente", ejecucion), paso("lider", ejecucion), paso("ejecutar", ejecucion, { hora }),
      paso("verificar", ejecucion), paso("posteriori", luego), paso("cerrar", luego)];
  }
  const agenda = sumarHabiles(ejecucion, -1, cfg);
  if (tipo === "Estándar") {
    const crear = sumarHabiles(ejecucion, -2, cfg);
    return [paso("crear", crear), paso("agente", crear), paso("lider", agenda),
      paso("cab", agenda, { nombre: "Change Management registra el cambio (preaprobado)" }),
      paso("agenda", agenda), paso("ejecutar", ejecucion, { hora }), paso("verificar", ejecucion), paso("cerrar", sumarHabiles(ejecucion, 1, cfg))];
  }
  const cab = ultimaSesionCab(sumarHabiles(ejecucion, -2, cfg), cfg);
  const seguridad = sumarHabiles(cab, -1, cfg);
  const lider = sumarHabiles(seguridad, -1, cfg);
  const crear = sumarHabiles(lider, -1, cfg);
  return [paso("crear", crear), paso("agente", crear), paso("lider", lider), paso("seguridad", seguridad),
    paso("cab", cab, { hora: cfg.cab.hora }), paso("agenda", agenda), paso("ejecutar", ejecucion, { hora }), paso("verificar", ejecucion),
    paso("cerrar", sumarHabiles(ejecucion, 1, cfg))];
}

const ocupadas = (fecha, calendario, excluirId) =>
  calendario.filter((c) => c.id !== excluirId && c.fecha === fecha && c.estado !== "Cancelado" && c.tipo !== "Emergencia");

/** Primera noche válida desde mañana: hábil, dentro de la ventana, sin congelamiento, con cupo y con tiempo para el plan. */
export function proximaVentana(tipo, hoy, cfg, calendario, excluirId) {
  for (let i = 1; i <= 120; i++) {
    const d = addDays(hoy, i);
    if (!esHabil(d, cfg) || !cfg.ventana.dias.includes(diaDe(d)) || congelamientoDe(d, cfg)) continue;
    if (ocupadas(d, calendario, excluirId).length >= cfg.ventana.maxPorNoche) continue;
    if (tipo !== "Emergencia" && planOcd(tipo, d, cfg)[0].fecha < hoy) continue;
    return d;
  }
  return null;
}

/** Cupo de las próximas noches de ventana, para mostrar el calendario. */
export function ventanasProximas(hoy, cfg, calendario, cantidad = 10) {
  const out = [];
  for (let i = 1; i <= 90 && out.length < cantidad; i++) {
    const d = addDays(hoy, i);
    if (!cfg.ventana.dias.includes(diaDe(d))) continue;
    const ids = ocupadas(d, calendario).map((c) => c.id);
    const motivo = feriadoDe(d, cfg)?.motivo || congelamientoDe(d, cfg)?.motivo || "";
    out.push({ fecha: d, dia: diaDe(d), ids, max: cfg.ventana.maxPorNoche, motivo, estado: motivo ? "cerrada" : ids.length >= cfg.ventana.maxPorNoche ? "llena" : "libre" });
  }
  return out;
}

/** Lee el Issue Form del OCD. */
export function ocdFromForm(fields, policy, cfg) {
  const marks = parseChecklist(fields["Requisitos del OCD"]);
  return {
    change: changeFromForm(fields, policy),
    matricula: clean(fields["Matrícula"]).slice(0, 12),
    perfil: /l[ií]der/i.test(clean(fields["Rol del solicitante"])) ? "Líder técnico" : "Team Member",
    historia: clean(fields["Historia asociada"]).slice(0, 12),
    instrucciones: clean(fields["Instrucciones de despliegue"]).slice(0, 4100),
    fecha: clean(fields["Fecha de ejecución"]).slice(0, 10),
    hora: clean(fields["Hora de inicio"]).slice(0, 5),
    ocdChecks: Object.fromEntries(Object.entries(cfg.controles).map(([k, c]) => [k, marks[c.etiqueta] === true])),
  };
}

/** Evalúa un OCD: riesgo del cambio + reglas de calendario + aprobadores + plan de fechas. */
export function assessOcd(o, incidents, policy, cfg, calendario, hoy) {
  const pedido = typeof hoy === "string" ? hoy : iso(hoy);
  const hoyS = fechaValida(pedido) ? pedido : iso(new Date());
  const dia = diaDe(o.fecha);
  const base = assess({ ...o.change, dia }, incidents, policy, toDate(hoyS));
  const factors = [...base.factors];
  const missing = [...base.missing];
  let extra = 0;
  for (const [k, c] of Object.entries(cfg.controles)) {
    if (o.ocdChecks?.[k]) continue;
    missing.push(c.etiqueta); factors.push({ label: `Falta: ${c.etiqueta}`, pts: c.peso }); extra += c.peso;
  }
  const score = Math.min(100, base.score + extra);
  const nivel = levelFor(policy, score).nivel;
  const tipo = o.change.tipo;
  const blockers = [...base.blockers];
  const advertencias = [];

  if (!cfg.tipos[tipo]) blockers.push("Elige el tipo de cambio: Estándar, Normal o Emergencia");
  const tipoEf = tipo === "Estándar" && ["Alto", "Crítico"].includes(nivel) ? "Normal" : tipo;
  if (tipoEf !== tipo) advertencias.push("El riesgo es Alto o Crítico: este cambio Estándar se trata como Normal (pasa por el Comité de Gestión de Cambios).");

  const valida = fechaValida(o.fecha);
  if (!valida) blockers.push("Fecha de ejecución inválida: usa el formato AAAA-MM-DD");
  const emergencia = tipo === "Emergencia";
  const cong = valida ? congelamientoDe(o.fecha, cfg) : undefined;
  const aprobadores = new Set(cfg.tipos[tipo]?.aprobadores ?? []);
  if (!emergencia || nivel === "Crítico") (cfg.adicionalesPorNivel[nivel] ?? []).forEach((a) => aprobadores.add(a));
  if (emergencia && cong) aprobadores.add("Delegado CIO");
  let plan = [];

  if (valida && cfg.tipos[tipo]) {
    plan = planOcd(tipoEf, o.fecha, cfg, o.hora && horaValida(o.hora) ? o.hora : cfg.ventana.horaInicio);
    const otros = ocupadas(o.fecha, calendario, o.id);
    const mismo = calendario.find((c) => c.id !== o.id && c.fecha === o.fecha && c.servicio === o.change.servicio && c.estado !== "Cancelado");
    if (mismo) advertencias.push(`Ya existe ${mismo.id} del mismo servicio ese día: coordinen para no solaparse.`);
    if (emergencia) {
      advertencias.push("Emergencia: se ejecuta ya y Seguridad y Change Management aprueban a posteriori en máximo 24 horas.");
      if (cong) advertencias.push(`Cae en congelamiento (${cong.motivo}): requiere al Delegado CIO.`);
    } else {
      if (o.fecha <= hoyS) blockers.push("La fecha de ejecución debe ser futura");
      const fer = feriadoDe(o.fecha, cfg);
      if (fer) blockers.push(`La fecha es feriado (${fer.motivo})`);
      else if (!esHabil(o.fecha, cfg) || !cfg.ventana.dias.includes(dia)) blockers.push(`Fuera de la ventana estándar (${cfg.ventana.dias.join(", ")}): ${o.fecha} cae ${dia}`);
      if (cong) blockers.push(`Congelamiento de cambios: ${cong.motivo}`);
      if (!horaValida(o.hora)) blockers.push("Hora de inicio inválida: usa HH:MM en formato 24 horas");
      else if (!enVentana(o.hora, cfg)) blockers.push(`Hora fuera de la ventana ${cfg.ventana.horaInicio}-${cfg.ventana.horaFin}`);
      if (otros.length >= cfg.ventana.maxPorNoche) blockers.push(`Ventana llena: ya hay ${otros.length} de ${cfg.ventana.maxPorNoche} OCD esa noche (${otros.map((c) => c.id).join(", ")})`);
      if (plan[0].fecha < hoyS) blockers.push(`Anticipación insuficiente: para esa fecha el OCD debía crearse el ${plan[0].fecha}`);
    }
    plan = plan.map((p) => ({ ...p, vencida: p.id !== "ejecutar" && p.fecha < hoyS }));
  }

  const sugerida = cfg.tipos[tipo] && !emergencia ? proximaVentana(tipoEf, hoyS, cfg, calendario, o.id) : null;
  const actions = base.actions.filter((a) => !(emergencia && a.includes("martes-jueves")));
  const calBloqueado = blockers.length > base.blockers.length;
  if (calBloqueado && sugerida) actions.unshift(`Reprogramar el OCD para el ${sugerida} (${diaDe(sugerida)}) a las ${cfg.ventana.horaInicio}: es la primera noche válida con cupo.`);

  return {
    ...base, score, nivel, missing, factors: factors.sort((a, b) => b.pts - a.pts), blockers: [...new Set(blockers)], advertencias,
    estado: blockers.length ? "Bloqueado" : "Listo para aprobaciones", approvals: [...aprobadores], aprobadores: [...aprobadores],
    actions: [...new Set(actions)], plan, tipoEfectivo: tipoEf, sugerida, fecha: o.fecha, hora: o.hora, dia,
  };
}

/** Informe Markdown del OCD para el Issue. */
export function renderOcdReport(o, r, policy, cfg, sol = null, rev = null) {
  const icon = r.estado === "Bloqueado" ? "🛑" : "✅";
  const L = [];
  L.push(`## ${icon} Evaluación del OCD: ${esc(o.change.servicio || "sin servicio")}`);
  L.push(`**Estado:** ${r.estado} · **Riesgo:** ${r.nivel} (${r.score}/100) · **Tipo:** ${esc(o.change.tipo || "sin tipo")}${r.tipoEfectivo !== o.change.tipo ? ` (tratado como ${r.tipoEfectivo})` : ""} · **Ejecución:** ${esc(o.fecha || "sin fecha")} ${r.dia ? `(${r.dia})` : ""} ${esc(o.hora || "")} · política \`${policy.version}\` / OCD \`${cfg.version}\``, "");
  if (r.blockers.length) L.push("### Bloqueos", ...r.blockers.map((b) => `- 🛑 ${esc(b)}`), "");
  if (sol?.encontrado) L.push("### Solicitante y grupos de red", `- 👤 ${esc(sol.usuario.nombre)} (${sol.matricula})`, ...sol.gruposDso.map((g) => `- ${g.tiene ? "✅" : "❌"} ${g.id} (grupo de red): ${esc(g.nombre)}`), ...sol.grupos.map((g) => `- ${g.tiene ? "✅" : "❌"} ${g.id} (servicio): ${esc(g.nombre)}`), "");
  if (rev?.historia) L.push("### Historia asociada", `- 📖 ${rev.historia.id} · ${esc(rev.historia.titulo)} (${esc(rev.historia.estado)})`, "");
  if (rev?.instr) L.push("### Instrucciones de despliegue", `- ${rev.instr.ok ? "✅ Válidas" : "🛑 Con bloqueos"}: ${rev.instr.pasos} paso(s) detectado(s)`, "");
  if (r.advertencias.length) L.push("### Advertencias", ...r.advertencias.map((a) => `- ⚠️ ${esc(a)}`), "");
  if (r.actions.length) L.push("### Qué hacer ahora", ...r.actions.map((a, i) => `${i + 1}. ${esc(a)}`), "");
  if (r.plan.length) {
    L.push("### Calendario del OCD (días hábiles, sin feriados)", "| Fecha | Día | Etapa | Responsable |", "|---|---|---|---|",
      ...r.plan.map((p) => `| ${p.fecha}${p.hora ? ` ${p.hora}` : ""}${p.vencida ? " ⚠️ vencida" : ""} | ${p.dia} | ${p.nombre} | ${p.responsable} |`), "");
  }
  L.push("### Aprobadores", ...r.aprobadores.map((a) => `- [ ] ${a}`), "");
  L.push("### Por qué este puntaje", "| Factor | Puntos |", "|---|---|", ...r.factors.map((f) => `| ${esc(f.label)} | +${f.pts} |`), "");
  if (r.similar.length) L.push("### Incidentes recientes del mismo servicio", ...r.similar.map((i) => `- **${i.id}** (${i.fecha}, ${i.severidad}): ${i.resumen}`), "");
  L.push("_Informe del agente OCD Las aprobaciones y la decisión final son de las personas indicadas._");
  return L.join("\n");
}

/* ---------- Equipo del OCD: grupos de red y aprobadores por servicio ---------- */

/** Revisa si el solicitante tiene los grupos de red del servicio y si eligió a los aprobadores que corresponden. */
export function validarEquipoOcd({ servicio, usuarioId, elegidos = {}, tipo = "Normal", perfil = "Team Member" }, dir, cfg) {
  const svc = dir.servicios[servicio];
  const usuario = dir.usuarios[usuarioId];
  if (!svc) return { servicioConocido: false, grupos: [], roles: [], mensajes: [`No conozco el servicio "${servicio}". Elige uno de la lista.`], completo: false };
  const grupos = revisarGruposDevsecops(usuario, dir, [], perfil).grupos;
  const base = (cfg.tipos[tipo]?.aprobadores ?? []).map((a) => a.replace(/\s*\(.*\)$/, "")).filter((a) => a in (dir.servicios[servicio]?.roles ?? {}));
  const roles = [...new Set(base)].map((rol) => {
    const esperado = svc.roles[rol];
    const elegido = elegidos[rol] || "";
    const estado = !elegido ? "falta" : elegido === esperado ? "ok" : "incorrecto";
    return { rol, esperado, esperadoNombre: dir.personas[esperado]?.nombre ?? "", elegido, elegidoNombre: dir.personas[elegido]?.nombre ?? "", estado };
  });
  const mensajes = [];
  for (const g of grupos.filter((x) => !x.tiene)) mensajes.push(`Te falta el grupo de red ${g.id} (${g.nombre}). ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}.`);
  for (const r of roles) {
    if (r.estado === "falta") mensajes.push(`Falta elegir al ${r.rol}. En ${servicio} es ${r.esperadoNombre}.`);
    if (r.estado === "incorrecto") mensajes.push(`${r.elegidoNombre} no es el ${r.rol} de ${servicio}. Corresponde a ${r.esperadoNombre}.`);
  }
  return { servicioConocido: true, grupos, roles, mensajes, completo: mensajes.length === 0 };
}

/* ---------- Solicitante: matrícula y grupos de red ---------- */

const RE_MATRICULA = /^M-?(\d{5})$/;
/** Normaliza una matrícula escrita como "m10458" o "M-10458". Devuelve "" si no tiene el formato. */
export const normalizarMatricula = (t) => { const m = String(t ?? "").trim().toUpperCase().match(RE_MATRICULA); return m ? `M-${m[1]}` : ""; };
/** Busca a la persona por su matrícula en el directorio (ficticio en la POC). */
export function buscarPorMatricula(dir, texto) {
  const mat = normalizarMatricula(texto);
  const id = mat && Object.keys(dir.usuarios).find((k) => dir.usuarios[k].matricula === mat);
  return id ? { id, matricula: mat, ...dir.usuarios[id] } : null;
}

/** Verifica que la matrícula exista y que tenga los grupos de red que exige el servicio. */
export function revisarSolicitanteOcd({ servicio, matricula, perfil = "Team Member" }, dir) {
  const out = { encontrado: false, matricula: "", usuario: null, grupos: [], gruposDso: [], bloqueos: [], advertencias: [], acciones: [] };
  const mat = normalizarMatricula(matricula);
  if (!String(matricula ?? "").trim()) { out.bloqueos.push("Falta la matrícula del solicitante"); return out; }
  if (!mat) { out.bloqueos.push("Matrícula inválida: usa el formato M-12345"); return out; }
  out.matricula = mat;
  const u = buscarPorMatricula(dir, mat);
  if (!u) { out.bloqueos.push(`La matrícula ${mat} no existe en el directorio`); return out; }
  out.encontrado = true; out.usuario = u;
  const dso = revisarGruposDevsecops(u, dir, [], perfil);
  out.gruposDso = dso.grupos; out.grupos = dso.grupos; out.perfil = perfil;
  for (const g of dso.faltan) out.bloqueos.push(`La matrícula ${mat} no tiene el grupo de red ${g.id} (${g.nombre}), necesario como ${perfil}`);
  if (dso.faltan.length) out.acciones.push(`Pide los grupos de red ${dso.faltan.map((g) => g.id).join(", ")}. ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}.`);
  return out;
}

/** Suma al resultado del OCD lo que encontraron las revisiones del solicitante, la historia y las instrucciones. */
export function combinarSolicitante(r, ...revs) {
  const blockers = [...new Set([...r.blockers, ...revs.flatMap((x) => x.bloqueos)])];
  return { ...r, blockers, advertencias: [...r.advertencias, ...revs.flatMap((x) => x.advertencias)], actions: [...revs.flatMap((x) => x.acciones), ...r.actions], estado: blockers.length ? "Bloqueado" : r.estado };
}

/* ---------- Grupos de red de DevSecOps, Helpdesk, historia e instrucciones del OCD ---------- */

/** Grupos de red que necesita quien crea un OCD según su rol (LT = ADMIN, TM = DEVELOPER). `extra` son grupos recién aprobados en la sesión. */
export function revisarGruposDevsecops(usuario, dir, extra = [], perfil = "Team Member") {
  const tiene = new Set([...(usuario?.gruposRed ?? []), ...extra]);
  const grupos = Object.entries(dir.gruposRed).filter(([, g]) => !perfil || g.perfil === perfil).map(([id, g]) => ({ id, ...g, tiene: tiene.has(id) }));
  return { grupos, faltan: grupos.filter((g) => !g.tiene), completo: grupos.every((g) => g.tiene) };
}

/** Solicitud simulada en Helpdesk para pedir grupos de red. */
export function crearSolicitudHelpdesk({ usuario, ids, dir, numero }) {
  return {
    key: `HD-${numero}`, cola: dir.solicitudRed.cola, estado: "Pendiente de aprobación", sla: dir.solicitudRed.sla,
    asunto: `Solicitud de red: ${ids.join(", ")}`, solicitante: `${usuario.nombre} (${usuario.matricula})`,
    aprobador: "Líder técnico del squad", grupos: ids.map((id) => ({ id, nombre: dir.gruposRed[id]?.nombre ?? id })),
  };
}

/** Normaliza "hu3101" o "HU-3101". Devuelve "" si no tiene el formato. */
export const normalizarHistoria = (t) => { const m = String(t ?? "").trim().toUpperCase().match(/^HU-?(\d{4})$/); return m ? `HU-${m[1]}` : ""; };

/** La historia debe existir y ser del mismo servicio del OCD. */
export function validarHistoria({ historia, servicio }, historias) {
  if (!String(historia ?? "").trim()) return { ok: false, motivo: "Falta la historia asociada" };
  const id = normalizarHistoria(historia);
  if (!id) return { ok: false, motivo: "Historia inválida: usa el formato HU-1234" };
  const h = historias.find((x) => x.id === id);
  if (!h) return { ok: false, motivo: `La historia ${id} no existe` };
  if (servicio && h.servicio !== servicio) return { ok: false, motivo: `La historia ${id} es del servicio ${h.servicio}, no de ${servicio}`, historia: h };
  return { ok: true, id, historia: h };
}

const limpio = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>@]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
/** Arma una historia de usuario simulada con criterios de aceptación estándar. */
export function armarHistoria({ rol, objetivo, beneficio, servicio, numero }) {
  const o = limpio(objetivo, 140), b = limpio(beneficio, 140), r = limpio(rol, 60) || "miembro del squad";
  return {
    id: `HU-${numero}`, servicio, titulo: o, estado: "Por hacer", responsable: r,
    descripcion: `Como ${r} quiero ${o} para ${b}.`,
    criterios: ["Las pruebas QA del cambio están aprobadas", "SAST, SCA y escaneo de secretos sin hallazgos críticos o altos", "Existe un rollback probado y un plan de verificación posterior"],
  };
}

export const SECRETOS = [/(password|passwd|contrase[nñ]a|pwd)\s*[=:]\s*\S+/i, /(api[_-]?key|secret|token)\s*[=:]\s*\S{6,}/i, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(postgres|mysql|mongodb|oracle):\/\/[^\s:@]+:[^\s@]+@/i];
export const PELIGROSO = [[/\brm\s+-rf\b/i, "rm -rf"], [/\bdrop\s+(table|database)\b/i, "DROP TABLE o DATABASE"], [/\btruncate\s+table\b/i, "TRUNCATE TABLE"], [/chmod\s+(-R\s+)?777/i, "chmod 777"], [/curl[^|\n]*\|\s*(ba)?sh\b/i, "curl | sh"], [/\bdelete\s+from\s+\w+\s*;?\s*$/im, "DELETE sin WHERE"]];

/** Revisa las instrucciones de despliegue que el solicitante entrega en las revisiones técnicas. */
export function validarInstrucciones(texto, { servicio = "", criticidad = "" } = {}) {
  const t = String(texto ?? "").trim();
  const bloqueos = [], avisos = [];
  if (t.length < 80) bloqueos.push("Las instrucciones son muy cortas: describe el despliegue paso a paso (mínimo 80 caracteres)");
  if (t.length > 4000) bloqueos.push("Las instrucciones superan los 4000 caracteres: resume y enlaza el runbook");
  const pasos = (t.match(/(?:^|\s)\d{1,2}[.)]\s+\S/g) || []).length || (t.match(/^\s*[-*•]\s+\S/gm) || []).length;
  if (pasos < 3) bloqueos.push("Escribe al menos 3 pasos numerados (1. 2. 3.)");
  if (!/rollback|revertir|reversa|volver a la versi/i.test(t)) bloqueos.push("Falta el paso de rollback: cómo se revierte si algo falla");
  if (!/verific|valida|smoke|prueba de humo|monitor/i.test(t)) bloqueos.push("Falta la verificación posterior: qué se revisa y cuánto tiempo (30 minutos)");
  if (SECRETOS.some((re) => re.test(t))) bloqueos.push("Hay una credencial o secreto escrito en el texto: quítalo y usa el gestor de secretos");
  for (const [re, nombre] of PELIGROSO) if (re.test(t)) bloqueos.push(`Comando peligroso (${nombre}): reemplázalo por un paso seguro y reversible`);
  if (servicio && !t.toLowerCase().includes(servicio.toLowerCase())) avisos.push(`No menciona el servicio ${servicio}: aclara sobre qué se ejecuta cada paso`);
  if (!/producci|\bprod\b|ventana|\d{2}:\d{2}/i.test(t)) avisos.push("No indica el ambiente (producción) ni la ventana de ejecución");
  if (criticidad === "Alta" && !/respaldo|backup|snapshot|precondici|prerrequisit/i.test(t)) avisos.push("El servicio es de criticidad Alta: añade un paso previo de respaldo o precondiciones");
  return { ok: bloqueos.length === 0, bloqueos, avisos, pasos };
}

/** Plantilla de instrucciones que pasa la validación, para quien no sabe por dónde empezar. */
export function plantillaInstrucciones({ servicio = "<servicio>", historia = "HU-0000", fecha = "<fecha>", hora = "22:00" } = {}) {
  return [
    `1. Confirmar con el líder técnico que la ventana del ${fecha} a las ${hora} sigue vigente y avisar al canal de operaciones.`,
    `2. Respaldo: verificar el respaldo o snapshot más reciente de ${servicio} antes de empezar.`,
    `3. Desplegar en producción la versión de la historia ${historia} con el workflow ocd-ejecucion, ambiente production.`,
    `4. Ejecutar las pruebas de humo del runbook de ${servicio}.`,
    `5. Verificación posterior: vigilar métricas y alertas de ${servicio} durante 30 minutos.`,
    `6. Rollback: si falla la verificación, volver a la versión anterior con el mismo workflow y avisar al líder técnico.`,
  ].join("\n");
}

/** Revisa historia e instrucciones de un OCD (para el agente real y el simulador). */
export function revisarHistoriaEInstrucciones({ historia, instrucciones, servicio, criticidad }, historias) {
  const out = { bloqueos: [], advertencias: [], acciones: [], historia: null, instr: null };
  const h = validarHistoria({ historia, servicio }, historias);
  if (!h.ok) { out.bloqueos.push(h.motivo); out.acciones.push("Asocia la historia del cambio (HU-1234). Si no tienes una, pídele al asistente que te ayude a crearla."); } else out.historia = h.historia;
  if (!String(instrucciones ?? "").trim()) out.advertencias.push("Aún no hay instrucciones de despliegue: se piden al llegar a las revisiones técnicas.");
  else {
    out.instr = validarInstrucciones(instrucciones, { servicio, criticidad });
    out.bloqueos.push(...out.instr.bloqueos.map((b) => `Instrucciones: ${b}`));
    out.advertencias.push(...out.instr.avisos.map((a) => `Instrucciones: ${a}`));
  }
  return out;
}
