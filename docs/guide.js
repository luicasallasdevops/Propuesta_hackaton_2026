// Guía interactiva: pasos, casos precargados, progreso guardado y estado en vivo desde la API pública de GitHub.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};

const FALLBACK_REPO = "luicasallasdevops/Propuesta_hackaton_2026";
const repo = (() => {
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  const name = location.pathname.split("/")[1];
  return m && name ? `${m[1]}/${name}` : FALLBACK_REPO;
})();
const gh = (path = "") => `https://github.com/${repo}${path}`;
const params = (o) => new URLSearchParams(o).toString();

const RIESGOSO = { servicio: "pagos-api", criticidad: "Alta", tamano: "Grande", dia: "Viernes", rollback: "No", checks: "none" };
const FELIZ = { servicio: "pagos-api", criticidad: "Alta", tamano: "Pequeño", dia: "Martes", rollback: "Sí, probado", checks: "all" };
const ticketUrl = (c) => gh(`/issues/new?${params({ template: "pase-produccion.yml", title: `[Pase] ${c.servicio} (demo)`, servicio: c.servicio })}`);

/* ---------- Acciones sobre el resto del portal ---------- */
const goTab = (id) => $(`#${id}`)?.click();

function ask(text) {
  goTab("t-chat");
  const chip = [...document.querySelectorAll("#chips button")].find((b) => b.textContent === text);
  if (chip) chip.click();
}

function runPreset(c) {
  goTab("t-pase");
  const f = $("#pase-form");
  if (!f || !f.elements.servicio) return;
  for (const k of ["servicio", "criticidad", "tamano", "dia", "rollback"]) f.elements[k].value = c[k];
  f.querySelectorAll("#checks input[type=checkbox]").forEach((i) => (i.checked = c.checks === "all"));
  f.requestSubmit();
  $("#resultado")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const link = (href, text) => ({ href, text });

/* ---------- Pasos ---------- */
const STEPS = [
  {
    id: "preguntar", icono: "💬", c: "c1", tiempo: "1 min", titulo: "Pregunta lo que necesitas saber",
    texto: "Escribe tu duda como se la harías a un compañero. El asistente responde con el estándar oficial y te dice de dónde sale la respuesta.",
    acciones: [
      { t: "¿Cómo creo un ticket de pase?", fn: () => ask("¿Cómo creo un ticket de pase a producción?") },
      { t: "¿Qué rol necesito?", fn: () => ask("¿Qué rol necesito y cómo lo pido?") },
    ],
    resultado: "Una respuesta clara con los pasos a seguir y la línea \"Fuente\" con el documento oficial.",
  },
  {
    id: "riesgoso", icono: "🚨", c: "c2", tiempo: "1 min", titulo: "Detecta un problema antes de que ocurra",
    texto: "Simulamos un cambio delicado: un servicio de pagos, un viernes, sin plan de reversa y sin revisiones de seguridad. Mira cómo el asistente lo frena a tiempo.",
    acciones: [{ t: "Probar el caso riesgoso", fn: () => runPreset(RIESGOSO) }],
    resultado: "Estado Bloqueado y riesgo Crítico (100 de 100), con los motivos, qué hacer para corregirlo y los incidentes pasados que lo respaldan.",
  },
  {
    id: "feliz", icono: "✅", c: "c3", tiempo: "1 min", titulo: "Corrige y obtén luz verde",
    texto: "El mismo servicio, pero preparado bien: cambio pequeño, un martes, con plan de reversa probado y todas las revisiones hechas.",
    acciones: [{ t: "Probar el camino feliz", fn: () => runPreset(FELIZ) }],
    resultado: "Estado Listo para aprobaciones. El riesgo baja y solo se piden las aprobaciones que corresponden a ese nivel.",
  },
  {
    id: "ticket", icono: "📝", c: "c4", tiempo: "2 min", titulo: "Crea el ticket real en GitHub",
    texto: "El título y el servicio ya vienen listos. Elige el resto con los datos del caso que ves abajo y pulsa crear. El título debe empezar con [Pase].",
    datos: [["🚨 Caso riesgoso", "Alta · Grande · Viernes · Rollback No · sin casillas marcadas"], ["✅ Camino feliz", "Alta · Pequeño · Martes · Rollback Sí, probado · las 9 casillas marcadas"]],
    acciones: [
      { t: "Ticket del caso riesgoso", href: ticketUrl(RIESGOSO) },
      { t: "Ticket del camino feliz", href: ticketUrl(FELIZ) },
    ],
    resultado: "Un ticket nuevo con los datos del cambio, listo para que el agente lo revise.",
  },
  {
    id: "agente", icono: "🤖", c: "c5", tiempo: "30 s", titulo: "Mira al agente trabajar",
    texto: "Al crear el ticket, el agente se activa solo en GitHub. Tú no tienes que hacer nada: solo mirar.",
    acciones: [{ t: "Ver al agente en acción", href: gh("/actions/workflows/agente-pase.yml") }, { t: "Ver mis tickets", href: gh("/issues") }],
    resultado: "En unos 20 segundos aparece un comentario con el informe de riesgo y etiquetas de color que resumen el estado.",
  },
  {
    id: "tablero", icono: "📋", c: "c9", tiempo: "30 s", titulo: "Sigue el pase en el tablero Kanban",
    texto: "Cada ticket es una tarjeta. El agente la coloca en Bloqueado o en Listo para aprobaciones, y las personas la avanzan hasta producción.",
    acciones: [{ t: "Abrir el tablero", href: `https://github.com/users/${repo.split("/")[0]}/projects/1` }],
    resultado: "Una tarjeta por ticket, en la columna que corresponde al resultado del agente.",
  },
  {
    id: "corregir", icono: "🔧", c: "c6", tiempo: "2 min", titulo: "Corrige el ticket y compara",
    texto: "Edita el ticket: marca las revisiones que faltaban y cambia el día o el plan de reversa. Cada cambio se reevalúa y el informe se actualiza solo.",
    acciones: [{ t: "Ir a mis tickets", href: gh("/issues") }],
    resultado: "El informe pasa de Bloqueado a Listo para aprobaciones y las etiquetas cambian solas.",
  },
  {
    id: "plantillas", icono: "📦", c: "c7", tiempo: "1 min", titulo: "Llévate las plantillas seguras",
    texto: "Procesos ya listos con las mejores prácticas de seguridad. Cópialos y úsalos en tu equipo sin empezar de cero.",
    acciones: [{ t: "Ver plantillas", fn: () => goTab("t-plant") }],
    resultado: "Plantillas de revisión de seguridad, publicación protegida y actualizaciones automáticas, con botón Copiar.",
  },
  {
    id: "tuyo", icono: "🚀", c: "c8", tiempo: "5 min", titulo: "Hazlo tuyo y escálalo",
    texto: "Ajusta los estándares, las reglas de riesgo y el historial de incidentes. Otras áreas solo cambian su carpeta de conocimiento.",
    acciones: [{ t: "Guía para equipos", href: gh("/blob/main/documentacion/04-guia-para-equipos.md") }, { t: "Hoja de ruta", href: gh("/blob/main/documentacion/05-seguridad-decisiones-roadmap.md") }],
    resultado: "Sabes cómo ampliar el conocimiento, ajustar el riesgo y replicarlo en tu área.",
  },
];

/* ---------- Progreso (localStorage es solo una comodidad) ---------- */
const KEY = "guia-poc-v1";
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* sin almacenamiento */ } };
let done = load();

/* ---------- Estado en vivo ---------- */
const rel = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function ago(iso) {
  const s = Math.round((new Date(iso) - Date.now()) / 1000);
  for (const [u, n] of [["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= n) return rel.format(Math.round(s / n), u);
  return "hace instantes";
}
const pillState = { ok: "✅", bad: "⛔", warn: "⏳", muted: "➖" };
const stateOf = (r) => (r.status !== "completed" ? ["en curso", "warn"] : r.conclusion === "success" ? ["ok", "ok"] : r.conclusion === "skipped" ? ["omitido", "muted"] : ["falló", "bad"]);
const safeUrl = (u) => (typeof u === "string" && u.startsWith("https://github.com/") ? u : gh());

async function api(path) {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(r.status === 403 ? "límite de consultas de GitHub, reintenta en unos minutos" : `HTTP ${r.status}`);
  return r.json();
}

async function refreshLive(box) {
  box.replaceChildren(el("p", { className: "muted", textContent: "Consultando GitHub…" }));
  try {
    const [runs, issues] = await Promise.all([api("/actions/runs?per_page=6"), api("/issues?state=all&per_page=15")]);
    const tickets = issues.filter((i) => !i.pull_request && i.title.startsWith("[Pase]")).slice(0, 4);
    box.replaceChildren(
      el("h3", { textContent: "⚙️ Últimas ejecuciones del agente" }),
      el("ul", { className: "live" }, runs.workflow_runs.map((r) => {
        const [txt, cls] = stateOf(r);
        return el("li", {}, el("span", { className: `pill ${cls}`, textContent: `${pillState[cls] || ""} ${txt}` }), " ",
          el("a", { href: safeUrl(r.html_url), target: "_blank", rel: "noopener", textContent: `${r.name} · ${r.display_title.slice(0, 60)}` }),
          el("span", { className: "muted", textContent: ` · ${ago(r.created_at)}` }));
      })),
      el("h3", { textContent: "🎫 Tickets de pase" }),
      tickets.length ? el("ul", { className: "live" }, tickets.map((i) => el("li", {},
        el("a", { href: safeUrl(i.html_url), target: "_blank", rel: "noopener", textContent: `#${i.number} ${i.title.slice(0, 70)}` }),
        " ", ...i.labels.map((l) => el("span", { className: "pill muted", textContent: l.name })))))
        : el("p", { className: "muted", textContent: "Aún no hay tickets. Abre el del paso 4." }),
    );
  } catch (e) {
    box.replaceChildren(el("p", { className: "muted", textContent: `No pude consultar GitHub (${e.message}). Puedes ver el estado en la pestaña Actions del repositorio.` }));
  }
}

/* ---------- Render ---------- */
function render(root) {
  const ring = el("div", { className: "ring", role: "img" }, el("b"));
  const ringTxt = ring.firstChild;
  const msg = el("p", { className: "hero-msg" });
  const journey = el("div", { className: "journey", role: "list", ariaLabel: "Recorrido de la guía" });
  const list = el("ol", { className: "steps" });
  const win = el("div", { className: "win", hidden: true },
    el("div", { className: "win-ico", textContent: "🎉", ariaHidden: "true" }),
    el("div", {}, el("h2", { textContent: "¡Recorrido completado!" }),
      el("p", { textContent: "Ya viste cómo se anticipa un problema, cómo se corrige y cómo se replica en tu área. Comparte esta guía con tu equipo." })));
  const dots = [], items = [];

  const goStep = (id) => items.find((x) => x.dataset.id === id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });

  const paint = () => {
    const pct = Math.round((done.size / STEPS.length) * 100);
    ring.style.setProperty("--p", String(pct));
    ring.setAttribute("aria-label", `${pct}% completado`);
    ringTxt.textContent = `${pct}%`;
    const next = STEPS.find((s) => !done.has(s.id));
    msg.textContent = next ? `Siguiente: ${next.titulo}` : "Completaste todos los pasos";
    win.hidden = done.size !== STEPS.length;
    items.forEach((li) => {
      const id = li.dataset.id, isDone = done.has(id);
      li.classList.toggle("done", isDone);
      li.classList.toggle("current", id === next?.id);
      const b = $(".toggle", li);
      b.setAttribute("aria-pressed", String(isDone));
      b.textContent = isDone ? "✓ Hecho" : "Marcar como hecho";
    });
    dots.forEach((d, i) => {
      const id = STEPS[i].id;
      d.classList.toggle("done", done.has(id));
      d.classList.toggle("current", id === next?.id);
      d.firstChild.textContent = done.has(id) ? "✓" : STEPS[i].icono;
    });
  };

  const setDone = (id, v) => { v ? done.add(id) : done.delete(id); save(done); paint(); };

  STEPS.forEach((s, i) => {
    const dot = el("button", { type: "button", className: `dot ${s.c}`, ariaLabel: `Paso ${i + 1}: ${s.titulo}`, title: s.titulo, onclick: () => goStep(s.id) }, el("span", { textContent: s.icono, ariaHidden: "true" }));
    dot.setAttribute("role", "listitem");
    dots.push(dot);
    journey.append(dot);

    const actions = el("div", { className: "acts" }, s.acciones.map((a) =>
      a.href ? el("a", { className: "btn", href: a.href, target: "_blank", rel: "noopener", textContent: `${a.t} ↗`, onclick: () => setDone(s.id, true) })
        : el("button", { type: "button", className: "btn", textContent: a.t, onclick: () => { a.fn(); setDone(s.id, true); } })));
    const toggle = el("button", { type: "button", className: "toggle", onclick: () => setDone(s.id, !done.has(s.id)) });
    const li = el("li", { className: s.c },
      el("div", { className: "tile", ariaHidden: "true" }, el("span", { textContent: s.icono }), el("small", { textContent: `Paso ${i + 1}` })),
      el("div", { className: "body" },
        el("h3", {}, s.titulo, " ", el("span", { className: "chip", textContent: `⏱ ${s.tiempo}` })),
        el("p", { textContent: s.texto }),
        s.datos ? el("dl", { className: "datos" }, s.datos.map(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v })])) : "",
        actions,
        el("p", { className: "expect" }, el("span", { textContent: "👀 ", ariaHidden: "true" }), el("strong", { textContent: "Qué verás: " }), s.resultado),
        toggle));
    li.dataset.id = s.id;
    items.push(li);
    list.append(li);
  });

  const live = el("div", { className: "card live-box" });
  const refresh = el("button", { type: "button", className: "btn ghost", textContent: "🔄 Actualizar", onclick: () => refreshLive(live) });
  const reset = el("button", { type: "button", className: "btn light", textContent: "Reiniciar", onclick: () => { done = new Set(); save(done); paint(); } });
  const start = el("button", { type: "button", className: "btn light solid", textContent: "▶ Continuar", onclick: () => goStep((STEPS.find((s) => !done.has(s.id)) || STEPS[0]).id) });

  root.replaceChildren(
    el("div", { className: "hero2" },
      el("div", { className: "hero-txt" },
        el("p", { className: "eyebrow", textContent: "🧭 Guía interactiva · 10 minutos" }),
        el("h2", { textContent: "Anticípate a los problemas antes de que ocurran" }),
        el("p", { className: "lead", textContent: "Recorre el flujo completo: preguntar, detectar un riesgo, corregirlo y ver al agente trabajar en GitHub. No necesitas ser técnico: cada paso tiene un botón que hace el trabajo por ti." }),
        el("ul", { className: "kpis" },
          el("li", {}, el("span", { textContent: "⏱️", ariaHidden: "true" }), " De semanas a minutos"),
          el("li", {}, el("span", { textContent: "🛡️", ariaHidden: "true" }), " Menos fallos en producción"),
          el("li", {}, el("span", { textContent: "🔁", ariaHidden: "true" }), " Reutilizable por otras áreas")),
        el("div", { className: "hero-acts" }, start, reset)),
      el("div", { className: "hero-prog" }, ring, msg)),
    el("div", { className: "journey-wrap" }, journey),
    win,
    list,
    el("div", { className: "card" }, el("div", { className: "live-head" }, el("h2", { textContent: "📡 Lo que está pasando ahora en GitHub" }), refresh), live),
  );
  paint();
  refreshLive(live);
}

const root = $("#guia-root");
if (root) render(root);

/* Botón para volver a la guía desde las pestañas a las que lleva cada paso */
for (const id of ["p-chat", "p-pase", "p-plant"]) {
  const panel = $(`#${id}`);
  if (!panel) continue;
  const back = el("button", { type: "button", className: "back", textContent: "🧭 Volver a la guía paso a paso", onclick: () => { goTab("t-guia"); scrollTo({ top: 0 }); } });
  panel.prepend(back);
}
