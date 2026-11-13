// Flujo gráfico del OCD: prerrequisitos → estados reales (de knowledge/ocd-flujo.json) → ramas si algo falla.
// Marca el paso actual cuando el asistente guía al usuario. Solo nodos DOM y textContent.
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const root = document.getElementById("flujo-root");

const PRE = [
  { id: "matricula", icono: "🪪", nombre: "Tu matrícula", sub: "Quién eres", texto: "Con tu matrícula el agente te identifica en el directorio." },
  { id: "grupos", icono: "🌐", nombre: "Grupos de red", sub: "LT: ADMIN · TM: DEVELOPER", texto: "Líder técnico: INCT_ADMIN_INCT_PROD y VSDP-ADMIN. Team Member: INCT_DEVELOPER_INCT_PROD y VSDP-DEVELOPER. Si falta alguno, el agente crea la solicitud en Helpdesk." },
  { id: "historia", icono: "🧩", nombre: "Historia en Jira", sub: "La HU que origina el cambio", texto: "Escribes el número (HU-1234), el agente la busca en Jira y tú confirmas título, tablero y quién la creó." },
  { id: "modalidad", icono: "🧱", nombre: "Modalidad", sub: "Quién ejecuta", texto: "Automatizado, Manual, Híbrido o DeployGO. El agente te muestra un ejemplo de cada una." },
  { id: "datos", icono: "📝", nombre: "Datos del cambio", sub: "Tipo, criticidad, rollback", texto: "Tipo de cambio, criticidad, plan de rollback y evidencias. La fecha llega más adelante, en Gestión de pase." },
];

async function init() {
  const flujo = await fetch("data/ocd-flujo.json").then((r) => { if (!r.ok) throw new Error("flujo"); return r.json(); });
  const estados = Object.entries(flujo.estados).map(([id, e]) => ({ id, ...e }));
  const principales = estados.filter((e) => !e.rama).sort((a, b) => a.orden - b.orden);
  const ramas = estados.filter((e) => e.rama).sort((a, b) => a.orden - b.orden);
  const detalle = el("div", { className: "fv-det", hidden: true, ariaLive: "polite" });
  const nodos = new Map();
  let abierto = null;

  const mostrar = (id, titulo, texto, extra) => {
    if (abierto === id) { detalle.hidden = true; abierto = null; nodos.forEach((n) => n.setAttribute("aria-expanded", "false")); return; }
    abierto = id;
    nodos.forEach((n, k) => n.setAttribute("aria-expanded", String(k === id)));
    detalle.replaceChildren(el("strong", { textContent: titulo }), el("p", { textContent: texto }), extra ?? "");
    detalle.hidden = false;
  };

  const nodo = ({ id, icono, nombre, sub, texto, clase = "" }) => {
    const b = el("button", { type: "button", className: `fv-n ${clase}`, ariaExpanded: "false", onclick: () => mostrar(id, nombre, texto, id.startsWith("estado:") ? "" : "") },
      el("span", { className: "fv-i", textContent: icono, ariaHidden: "true" }), el("span", { className: "fv-t" }, el("strong", { textContent: nombre }), el("small", { textContent: sub })));
    nodos.set(id, b);
    return el("li", {}, b);
  };

  const lanePre = el("ol", { className: "fv-lane" }, PRE.map(nodo));
  const laneEst = el("ol", { className: "fv-lane" }, principales.map((e, i) => nodo({
    id: e.id, icono: e.id === "gestion_pase" ? "📅" : e.id === "done" ? "🏁" : String(i + 1), nombre: e.nombre,
    sub: `${flujo.roles[e.actor]?.nombre ?? e.actor}${e.sla ? ` · ${e.sla} d. háb.` : ""}`,
    texto: `${e.queHacer}${e.id === "gestion_pase" ? " Aquí se define la fecha y la hora del pase." : ""}`, clase: e.id === "gestion_pase" ? "clave" : "" })));
  const laneRamas = el("ol", { className: "fv-lane ramas" }, ramas.map((e) => nodo({
    id: e.id, icono: "↩️", nombre: e.nombre, sub: `${flujo.roles[e.actor]?.nombre ?? e.actor}`, texto: `Solo si algo falla. ${e.queHacer}`, clase: "rama" })));

  const cta = el("button", { type: "button", className: "fv-cta", textContent: "Crear mi OCD paso a paso", onclick: () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.dispatchEvent(new CustomEvent("chat:ask", { detail: "Quiero crear un OCD" }));
  } });

  root.replaceChildren(
    el("div", { className: "fv-bloque" }, el("h3", { textContent: "1 · Antes de empezar" }), lanePre),
    el("div", { className: "fv-puente", ariaHidden: "true", textContent: "▼" }),
    el("div", { className: "fv-bloque" }, el("h3", { textContent: "2 · El OCD, estado por estado" }), laneEst),
    el("div", { className: "fv-bloque suave" }, el("h3", { textContent: "Si algo falla" }), laneRamas),
    detalle, el("p", { className: "fv-pie" }, cta));

  document.addEventListener("ocd:paso", (e) => {
    const id = e.detail;
    nodos.forEach((n, k) => { n.classList.toggle("actual", k === id); });
    const n = nodos.get(id);
    if (n) { n.classList.add("visto"); }
    const orden = [...PRE.map((x) => x.id), ...principales.map((x) => x.id)];
    const i = orden.indexOf(id);
    if (i >= 0) orden.slice(0, i).forEach((k) => nodos.get(k)?.classList.add("visto"));
  });
}
if (root) init().catch((e) => root.replaceChildren(el("p", { className: "muted", textContent: `No pude cargar el flujo (${e.message}).` })));
