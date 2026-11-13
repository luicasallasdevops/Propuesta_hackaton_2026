import { splitSections, search, assess } from "./engine.mjs";
import { crearAsistenteOcd } from "./ocd-assistant.js";
import { crearAgenteChat } from "./agente-chat.js";
import { detalle } from "./ui.js";

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
  window.scrollTo({ top: 0, behavior: "auto" });
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

/* Chat: cada respuesta del agente aparece tras una breve espera con el indicador de "escribiendo" */
const log = $("#log");
const gpt = $("#gpt");
const cola = [];
let ocupado = false;
const textoDe = (nodos) => nodos.reduce((a, n) => a + (typeof n === "string" ? n.length : (n?.textContent?.length ?? 0)), 0);
const escribiendo = () => el("div", { className: "msg bot typing", role: "status", ariaLabel: "El asistente está escribiendo" }, el("span", { className: "dots" }, el("i"), el("i"), el("i")));
function mostrar({ who, content }) {
  const m = el("div", { className: `msg ${who}` }, content);
  log.append(m);
  m.querySelector(".campo-in")?.focus({ preventScroll: true });
  m.scrollIntoView({ block: who === "user" ? "end" : "start", behavior: "auto" });
}
function bombear() {
  if (ocupado || !cola.length) return;
  ocupado = true;
  const it = cola.shift();
  if (it.who === "user") { mostrar(it); ocupado = false; bombear(); return; }
  const t = escribiendo();
  log.append(t);
  t.scrollIntoView({ block: "end", behavior: "auto" });
  setTimeout(() => { t.remove(); mostrar(it); ocupado = false; bombear(); }, Math.min(2200, 900 + textoDe(it.content) * 5));
}
/* Transición suave al enviar el primer mensaje: lo de la portada se desvanece y el campo se desliza hacia abajo. */
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
let saliendo = false;
function salirDeVacio() {
  saliendo = true; ocupado = true;
  const comp = $(".composer");
  const antes = comp.getBoundingClientRect().top;
  gpt.classList.add("saliendo");
  setTimeout(() => {
    gpt.dataset.vacio = "false"; gpt.classList.remove("saliendo");
    if (!reducido) {
      const despues = comp.getBoundingClientRect().top;
      comp.style.transition = "none"; comp.style.transform = `translateY(${antes - despues}px)`;
      comp.getBoundingClientRect();
      comp.style.transition = "transform .5s cubic-bezier(.2,.8,.2,1)"; comp.style.transform = "";
      setTimeout(() => { comp.style.transition = ""; }, 520);
    }
    saliendo = false; ocupado = false; bombear();
  }, reducido ? 0 : 220);
}
const say = (who, ...content) => {
  cola.push({ who, content });
  if (gpt.dataset.vacio === "true") { if (!saliendo) salirDeVacio(); return; }
  bombear();
};

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

const ocdIssueUrl = ({ servicio = "", fecha = "", hora = "" } = {}) => `${issueUrl().replace("pase-produccion.yml", "ocd.yml")}&${new URLSearchParams({ title: `[OCD] ${servicio}`, servicio, fecha, hora })}`;
const retomarSiPausa = () => { if (asistenteOcd.pausado && !asistenteOcd.activo) asistenteOcd.ofrecerRetomar(); };
const siguientesPasos = (...b) => say("bot", el("p", { className: "muted", textContent: "¿Seguimos? Puedo ayudarte con esto:" }), el("div", { className: "qrs" }, b.map(([t, fn]) => el("button", { type: "button", className: "qr", textContent: t, onclick: () => { say("user", t); fn(); } }))));

const agente = crearAgenteChat({ say, el, dir: ocdDir, cfg: ocdCfg, cal: ocdCal, policy, incidents, asistenteOcd, preguntar: (t) => { say("user", t); answer(t); }, ocdIssueUrl });

function answer(q) {
  const estabaActivo = asistenteOcd.activo;
  if (estabaActivo && /^(menu|menú|opciones|hola|buenas|buenos dias|buenos días|gracias)\b/i.test(q)) asistenteOcd.pausar();
  else if (estabaActivo && asistenteOcd.manejar(q)) return;
  if (agente.manejar(q)) { retomarSiPausa(); return; }
  if (!estabaActivo && asistenteOcd.manejar(q)) return;
  responderEstandar(q);
  retomarSiPausa();
}

function responderEstandar(q) {
  const wantsTpl = /workflow|action|pipeline|plantilla|yaml|codeql|dependabot|release/i.test(q);
  const hits = wantsTpl ? [] : search(sections, q, 2);
  if (!hits.length && !wantsTpl) {
    say("bot", el("p", { textContent: "Eso todavía no lo tengo en los estándares, pero puedo ayudarte con estas cosas:" }));
    agente.menu("¿Cuál de estas te sirve?");
    return;
  }
  const resumen = (t) => { const l = t.split("\n").map((x) => x.replace(/^(\d+\.|-|>)\s*/, "").replace(/`/g, "").trim()).find(Boolean) ?? ""; return l.length > 240 ? `${l.slice(0, 237)}…` : l; };
  const parts = hits.map((h) => el("div", {}, el("h3", { textContent: h.heading }), el("p", { textContent: resumen(h.text) }),
    detalle("Ver el detalle", renderText(h.text), { texto: `${h.docTitle} › ${h.heading}`, ruta: `knowledge/${h.doc}.md` })));
  const src = "";
  if (wantsTpl) {
    const key = /dependabot/i.test(q) ? ["dependabot.yml"] : /release|produccion|producción|despleg/i.test(q) ? ["workflows/release-produccion.yml"] : ["workflows/ci-seguridad.yml"];
    say("bot", el("p", { textContent: "Plantilla oficial lista para copiar:" }), ...key.map((k) => detalle(`Ver la plantilla ${k}`, templateCard(k, tpl[k]), { texto: `templates/${k}`, ruta: `templates/${k}` })));
  }
  if (/ocd/i.test(q)) {
    say("bot", el("p", {}, "Si prefieres, también puedes abrir el OCD directamente en GitHub: ", el("a", { href: ocdIssueUrl(), textContent: "abrir OCD", rel: "noopener", target: "_blank" })));
    asistenteOcd.ofrecer();
    return;
  }
  if (/ticket|pase/i.test(q)) say("bot", el("p", {}, "Crea el ticket con el formulario y el agente lo evalúa al instante: ", el("a", { href: issueUrl(), textContent: "abrir ticket de pase", rel: "noopener", target: "_blank" })));
  if (!asistenteOcd.pausado) siguientesPasos(["Crear mi OCD paso a paso", () => asistenteOcd.iniciarConDatos(agente.contexto.cambio.servicio ? { servicio: agente.contexto.cambio.servicio } : {})], ["Validar mi pase", () => agente.pedirCambio()], ["Ver el menú", () => agente.menu()]);
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
document.addEventListener("chat:ask", (e) => { const t = String(e.detail ?? "").slice(0, 300); if (t) { say("user", t); answer(t); } });
for (const [etq, fn] of [["🏠 Menú", () => agente.menu()], ["📅 Crear mi OCD", () => asistenteOcd.iniciarConDatos(agente.contexto.cambio.servicio ? { servicio: agente.contexto.cambio.servicio } : {})], ["🚀 Validar mi pase", () => agente.pedirCambio()], ["🧭 Cómo funciona el OCD", () => asistenteOcd.explicarFlujo()], ["👥 Mi rol", () => asistenteOcd.preguntarRol()]]) {
  const b = el("button", { type: "button", textContent: etq });
  b.addEventListener("click", () => { say("user", etq.replace(/^\S+\s/, "")); fn(); });
  $("#chips").append(b);
}
$("#hero-t").textContent = `${agente.saludoHora()} ¿Qué quieres hacer hoy?`;
$("#sugs").append(agente.menuNodo());
for (const t of ["Necesito desplegar pagos-api este viernes y no tengo rollback", "Quiero crear un OCD", "¿Cómo funciona el OCD?"]) {
  $("#sugs").append(el("button", { type: "button", textContent: t, onclick: () => { say("user", t); answer(t); } }));
}

/* Validador de pase */
const checks = $("#checks");
for (const [key, c] of Object.entries(policy.controles)) {
  checks.append(el("label", {}, el("input", { type: "checkbox", name: key }), c.etiqueta));
}
$("#pase-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const change = {
    servicio: String(f.get("servicio")).trim().slice(0, 80), criticidad: f.get("criticidad"),
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
