import { splitSections, search, assess } from "./engine.mjs";
import { crearAsistenteOcd } from "./ocd-assistant.js";

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const load = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
const [kb, tpl, incidents, policy, ocdCfg, ocdCal, ocdDir, ocdHist, ocdFlujo] = await Promise.all(["kb.json", "templates.json", "incidents.json", "policy.json", "ocd.json", "ocd-calendario.json", "ocd-directorio.json", "ocd-historias.json", "ocd-flujo.json"].map(load));
const sections = splitSections(kb);

/* Pestañas */
const tabs = [...document.querySelectorAll('[role=tab]')];
tabs.forEach((t) => t.addEventListener("click", () => {
  tabs.forEach((x) => {
    const on = x === t;
    x.setAttribute("aria-selected", on);
    $("#" + x.getAttribute("aria-controls")).hidden = !on;
  });
}));

/* Renderizado seguro de texto Markdown simple (solo nodos DOM, sin innerHTML) */
function renderText(text) {
  const box = el("div");
  let list = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^(?:\d+\.|-) (.+)$/);
    if (m) {
      const ordered = /^\d/.test(line);
      if (!list || list.tagName !== (ordered ? "OL" : "UL")) { list = el(ordered ? "ol" : "ul"); box.append(list); }
      list.append(el("li", { textContent: m[1].replace(/`/g, "") }));
    } else if (line.trim()) { list = null; box.append(el("p", { textContent: line.replace(/^> /, "").replace(/`/g, "") })); }
  }
  return box;
}

/* Chat */
const log = $("#log");
const say = (who, ...content) => { const m = el("div", { className: `msg ${who}` }, content); log.append(m); m.scrollIntoView({ block: "end" }); };

const asistenteOcd = crearAsistenteOcd({ say, el, dir: ocdDir, cfg: ocdCfg, cal: ocdCal, policy, incidents, historias: ocdHist, flujo: ocdFlujo, ir: (prefill) => {
  $("#t-ocd").click();
  setTimeout(() => { document.dispatchEvent(new CustomEvent("ocd:prefill", { detail: prefill })); $("#jira-sim")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 200);
} });

function copyButton(text) {
  const b = el("button", { type: "button", textContent: "Copiar" });
  b.addEventListener("click", async () => { await navigator.clipboard.writeText(text); b.textContent = "¡Copiado!"; setTimeout(() => (b.textContent = "Copiar"), 1500); });
  return b;
}
const templateCard = (name, body) => el("div", { className: "tpl card" },
  el("header", {}, el("strong", { textContent: name }), copyButton(body)),
  el("pre", {}, el("code", { textContent: body })));

function answer(q) {
  if (asistenteOcd.manejar(q)) return;
  const wantsTpl = /workflow|action|pipeline|plantilla|yaml|codeql|dependabot|release/i.test(q);
  const hits = wantsTpl ? [] : search(sections, q, 2);
  if (!hits.length && !wantsTpl) {
    say("bot", el("p", { textContent: "No encontré eso en los estándares. Prueba con: pase a producción, rol, red, licencias, ticket, SAST o SCA." }));
    return;
  }
  const parts = hits.map((h) => el("div", {}, el("h3", { textContent: h.heading }), renderText(h.text)));
  const src = hits.length ? el("div", { className: "src", textContent: "Fuente: " + hits.map((h) => `${h.docTitle} › ${h.heading}`).join(" · ") }) : "";
  say("bot", parts, src);
  if (wantsTpl) {
    const key = /dependabot/i.test(q) ? ["dependabot.yml"] : /release|produccion|producción|despleg/i.test(q) ? ["workflows/release-produccion.yml"] : ["workflows/ci-seguridad.yml"];
    say("bot", el("p", { textContent: "Plantilla oficial lista para copiar:" }), ...key.map((k) => templateCard(k, tpl[k])));
  }
  if (/ocd/i.test(q)) {
    say("bot", el("p", {}, "Practica creando un OCD en el simulador de Jira de la pestaña Pase OCD, o prueba el agente real en GitHub: ", el("a", { href: issueUrl().replace("pase-produccion.yml", "ocd.yml"), textContent: "abrir OCD", rel: "noopener" })));
    asistenteOcd.ofrecer();
  }
  else if (/ticket|pase/i.test(q)) say("bot", el("p", {}, "Crea el ticket con el formulario y el agente lo evalúa al instante: ", el("a", { href: issueUrl(), textContent: "abrir ticket de pase", rel: "noopener" })));
}

function issueUrl() {
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  const repo = m && location.pathname.split("/")[1] ? `${m[1]}/${location.pathname.split("/")[1]}` : "hybridcloudcompany/Grupo11";
  return `https://github.com/${repo}/issues/new?template=pase-produccion.yml`;
}

$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#q").value.trim().slice(0, 300);
  if (!q) return;
  say("user", q); $("#q").value = ""; answer(q);
});
for (const s of ["¿Cómo creo un ticket de pase a producción?", "¿Qué rol necesito y cómo lo pido?", "¿Qué grupos de red necesito?", "Dame un workflow de CodeQL", "¿Qué licencias necesito?", "¿Cómo creo un OCD paso a paso?", "¿Quién aprueba un OCD?", "¿Qué grupos de red necesito para un OCD?", "¿Qué reglas de calendario tiene un OCD?", "Quiero crear un OCD"]) {
  const b = el("button", { type: "button", textContent: s });
  b.addEventListener("click", () => { say("user", s); answer(s); });
  $("#chips").append(b);
}
say("bot", el("p", { textContent: "Hola. Soy el asistente DevSecOps. Te explico el flujo de pase a producción, roles, red, licencias y te doy plantillas listas. También puedes validar tu pase en la pestaña \"Validar mi pase\"." }));

/* Validador de pase */
const checks = $("#checks");
for (const [key, c] of Object.entries(policy.controles)) {
  checks.append(el("label", {}, el("input", { type: "checkbox", name: key }), c.etiqueta));
}
$("#pase-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const change = {
    servicio: String(f.get("servicio")).trim().slice(0, 80), criticidad: f.get("criticidad"), tamano: f.get("tamano"),
    dia: f.get("dia"), rollback: f.get("rollback"),
    checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, f.get(k) === "on"])),
  };
  const r = assess(change, incidents, policy);
  const color = r.estado === "Bloqueado" ? "bad" : r.score < 30 ? "ok" : "warn";
  const list = (items, tag = "ul") => el(tag, {}, items.map((t) => el("li", { textContent: t })));
  const out = $("#resultado");
  out.replaceChildren(el("div", { className: "res" },
    el("h2", { textContent: `Resultado para ${change.servicio}` }),
    el("div", { className: "score" }, el("span", { className: `pill ${color}`, textContent: r.estado }),
      el("div", { className: "meter", role: "img", ariaLabel: `Riesgo ${r.score} de 100` }, Object.assign(el("i"), { style: `width:${r.score}%;background:var(--${color === "ok" ? "ok" : color === "bad" ? "bad" : "warn"})` })),
      el("strong", { textContent: `${r.nivel} · ${r.score}/100` })),
    r.blockers.length ? [el("h3", { textContent: "Bloqueos" }), list(r.blockers)] : "",
    r.actions.length ? [el("h3", { textContent: "Acciones preventivas" }), list(r.actions, "ol")] : "",
    el("h3", { textContent: "Aprobaciones requeridas" }), list(r.approvals),
    r.similar.length ? [el("h3", { textContent: "Incidentes recientes del servicio" }), list(r.similar.map((i) => `${i.id} (${i.fecha}): ${i.resumen}`))] : "",
    el("h3", { textContent: "Por qué este puntaje" }), list(r.factors.map((x) => `${x.label}: +${x.pts}`)),
    el("p", {}, el("a", { className: "btn", href: issueUrl(), textContent: "Abrir ticket en GitHub", rel: "noopener" }))));
});
if (!$("#resultado").dataset.init) $("#resultado").dataset.init = "1";

/* Plantillas */
for (const [name, body] of Object.entries(tpl)) $("#plantillas").append(templateCard(name, body));
