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
    tamano: clean(fields["Tamaño del cambio"]),
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
  add(`Tamaño ${change.tamano}`, policy.tamano[change.tamano] ?? 0);
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
  if (change.tamano === "Grande") active.add("cambio-grande");
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

const esc = (s) => String(s).replace(/@/g, "@​").replace(/[<>]/g, "");

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
  L.push("_Informe generado por el agente de pre-validación (POC, datos simulados). La decisión final es del squad y de las aprobaciones indicadas._");
  return L.join("\n");
}
