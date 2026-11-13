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
const ticketUrl = (c) => gh(`/issues/new?${params({ template: "pase-produccion.yml", title: `[Pase] ${c.servicio} (demo)`, servicio: c.servicio, criticidad: c.criticidad, tamano: c.tamano, dia: c.dia, rollback: c.rollback })}`);

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
    id: "preguntar", tiempo: "1 min", titulo: "Pregunta lo que necesitas saber",
    texto: "El asistente responde con el estándar exacto y cita la fuente. Sin buscar en wikis ni esperar a nadie.",
    acciones: [
      { t: "¿Cómo creo un ticket de pase?", fn: () => ask("¿Cómo creo un ticket de pase a producción?") },
      { t: "¿Qué rol necesito?", fn: () => ask("¿Qué rol necesito y cómo lo pido?") },
    ],
    resultado: "Una respuesta con los pasos y la línea \"Fuente: …\" con el documento y la sección.",
  },
  {
    id: "riesgoso", tiempo: "1 min", titulo: "Valida un cambio riesgoso",
    texto: "Simula un pase de pagos-api en viernes, sin rollback y sin evidencias. Así se anticipa el problema antes de llegar a producción.",
    acciones: [{ t: "Cargar caso riesgoso y evaluar", fn: () => runPreset(RIESGOSO) }],
    resultado: "Estado Bloqueado y riesgo Crítico 100/100, con los bloqueos, las acciones preventivas y los incidentes pasados que lo respaldan.",
  },
  {
    id: "feliz", tiempo: "1 min", titulo: "Corrige y llega al camino feliz",
    texto: "El mismo servicio, pero con cambio pequeño, martes, rollback probado y todos los controles cumplidos.",
    acciones: [{ t: "Cargar camino feliz y evaluar", fn: () => runPreset(FELIZ) }],
    resultado: "Estado Listo para aprobaciones. El riesgo baja a Medio o Bajo (depende de los incidentes recientes) y solo piden las aprobaciones de ese nivel.",
  },
  {
    id: "ticket", tiempo: "2 min", titulo: "Abre el ticket real en GitHub",
    texto: "El formulario viene precargado con el caso. Marca las casillas de evidencias que correspondan y crea el Issue. El título debe empezar con [Pase].",
    acciones: [
      { t: "Abrir ticket del caso riesgoso", href: ticketUrl(RIESGOSO) },
      { t: "Abrir ticket del camino feliz", href: ticketUrl(FELIZ) },
    ],
    resultado: "Un Issue nuevo con los datos del cambio. Si algún campo no se precargó, elígelo en el formulario.",
  },
  {
    id: "agente", tiempo: "30 s", titulo: "Mira al agente trabajar",
    texto: "Al crear o editar el ticket se ejecuta el agente en GitHub Actions. No tienes que hacer nada.",
    acciones: [{ t: "Ver ejecuciones del agente", href: gh("/actions/workflows/agente-pase.yml") }, { t: "Ver mis tickets", href: gh("/issues") }],
    resultado: "En unos 20 segundos aparece un comentario del bot con el informe y las etiquetas de riesgo y de estado.",
  },
  {
    id: "corregir", tiempo: "2 min", titulo: "Corrige el ticket y compara",
    texto: "Edita el Issue: marca las casillas faltantes y cambia el día o el rollback. Cada edición reevalúa y actualiza el mismo comentario.",
    acciones: [{ t: "Ir a mis tickets", href: gh("/issues") }],
    resultado: "El informe pasa de Bloqueado a Listo para aprobaciones y las etiquetas se actualizan solas.",
  },
  {
    id: "plantillas", tiempo: "1 min", titulo: "Lleva las plantillas a tu repositorio",
    texto: "Workflows oficiales con permisos mínimos y versiones actuales. Cópialos tal cual a .github/workflows.",
    acciones: [{ t: "Ver plantillas", fn: () => goTab("t-plant") }],
    resultado: "CI de seguridad con CodeQL y Dependency Review, release protegido y Dependabot, con botón Copiar.",
  },
  {
    id: "tuyo", tiempo: "5 min", titulo: "Hazlo tuyo",
    texto: "Cambia los estándares, la política de riesgo y los incidentes con un pull request. Otras tribus solo reemplazan la carpeta knowledge.",
    acciones: [{ t: "Guía para equipos", href: gh("/blob/main/documentacion/04-guia-para-equipos.md") }, { t: "Hoja de ruta", href: gh("/blob/main/documentacion/05-seguridad-decisiones-roadmap.md") }],
    resultado: "Sabes cómo ampliar el conocimiento, ajustar el riesgo y replicarlo en tu tribu.",
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
      el("h3", { textContent: "Últimas ejecuciones" }),
      el("ul", { className: "live" }, runs.workflow_runs.map((r) => {
        const [txt, cls] = stateOf(r);
        return el("li", {}, el("span", { className: `pill ${cls}`, textContent: txt }), " ",
          el("a", { href: safeUrl(r.html_url), target: "_blank", rel: "noopener", textContent: `${r.name} · ${r.display_title.slice(0, 60)}` }),
          el("span", { className: "muted", textContent: ` · ${ago(r.created_at)}` }));
      })),
      el("h3", { textContent: "Tickets de pase" }),
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
  const bar = el("progress", { max: STEPS.length, value: done.size, ariaLabel: "Progreso de la guía" });
  const label = el("strong");
  const list = el("ol", { className: "steps" });

  const paint = () => {
    bar.value = done.size;
    label.textContent = done.size === STEPS.length ? "¡Completaste la guía!" : `${done.size} de ${STEPS.length} pasos`;
    const next = STEPS.find((s) => !done.has(s.id))?.id;
    list.querySelectorAll("li").forEach((li) => {
      li.classList.toggle("done", done.has(li.dataset.id));
      li.classList.toggle("current", li.dataset.id === next);
      $("input", li).checked = done.has(li.dataset.id);
    });
  };

  STEPS.forEach((s, i) => {
    const check = el("input", { type: "checkbox", id: `chk-${s.id}` });
    check.addEventListener("change", () => { check.checked ? done.add(s.id) : done.delete(s.id); save(done); paint(); });
    const actions = el("div", { className: "acts" }, s.acciones.map((a) =>
      a.href ? el("a", { className: "btn", href: a.href, target: "_blank", rel: "noopener", textContent: `${a.t} ↗` })
        : el("button", { type: "button", className: "btn", textContent: a.t, onclick: () => { a.fn(); } })));
    const li = el("li", {},
      el("div", { className: "num", textContent: String(i + 1), ariaHidden: "true" }),
      el("div", { className: "body" },
        el("h3", {}, s.titulo, " ", el("span", { className: "chip", textContent: s.tiempo })),
        el("p", { textContent: s.texto }),
        actions,
        el("p", { className: "expect" }, el("strong", { textContent: "Qué deberías ver: " }), s.resultado),
        el("label", { className: "mark", htmlFor: check.id }, check, " Marcar como hecho")));
    li.dataset.id = s.id;
    list.append(li);
  });

  const live = el("div", { className: "card live-box" });
  const refresh = el("button", { type: "button", className: "btn ghost", textContent: "Actualizar estado", onclick: () => refreshLive(live) });
  const reset = el("button", { type: "button", className: "btn ghost", textContent: "Reiniciar progreso", onclick: () => { done = new Set(); save(done); paint(); } });

  root.replaceChildren(
    el("div", { className: "card hero" },
      el("h2", { textContent: "Recorre el flujo completo en 10 minutos" }),
      el("p", { className: "muted", textContent: "Del chat al informe del agente en GitHub. Cada paso tiene un botón que hace el trabajo por ti y te dice qué debería pasar." }),
      el("div", { className: "prog" }, bar, label, reset)),
    list,
    el("div", { className: "card" }, el("div", { className: "live-head" }, el("h2", { textContent: "Estado en vivo del repositorio" }), refresh), live),
  );
  paint();
  refreshLive(live);
}

const root = $("#guia-root");
if (root) render(root);
