// Panel de progreso: solo aparece mientras el asistente guía la creación de un OCD.
// Muestra los requisitos (matrícula, grupos, historia, modalidad, datos) y el estado del OCD. Otras preguntas no lo muestran.
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const root = document.getElementById("progreso");
const REQ = [["matricula", "Matrícula"], ["grupos", "Grupos de red"], ["historia", "Historia"], ["modalidad", "Modalidad"], ["datos", "Datos"]];

async function init() {
  const flujo = await fetch("data/ocd-flujo.json").then((r) => { if (!r.ok) throw new Error("flujo"); return r.json(); });
  const estados = Object.entries(flujo.estados).filter(([, e]) => !e.rama).sort((a, b) => a[1].orden - b[1].orden).map(([id, e]) => ({ id, nombre: e.nombre }));
  const ramas = new Map(Object.entries(flujo.estados).filter(([, e]) => e.rama).map(([id, e]) => [id, e.nombre]));
  let actual = null;
  let info = null;

  const pintar = () => {
    if (!actual) { root.hidden = true; return; }
    const iReq = REQ.findIndex(([k]) => k === actual);
    const iEst = estados.findIndex((e) => e.id === actual);
    const enRama = ramas.has(actual);
    const hechos = iReq >= 0 ? iReq : REQ.length + (iEst >= 0 ? iEst : estados.length - 1);
    const total = REQ.length + estados.length;
    const pct = Math.round((hechos / total) * 100);
    const etiquetaEstado = iEst >= 0 ? `Estado ${iEst + 1} de ${estados.length} · ${estados[iEst].nombre}` : enRama ? `Rama: ${ramas.get(actual)}` : iReq >= 0 ? "El OCD se crea al terminar los requisitos" : "";
    root.replaceChildren(
      el("div", { className: "prog-top" },
        el("strong", { textContent: info?.key ? `${info.key}${info.servicio ? ` · ${info.servicio}` : ""}${info.modalidad ? ` · ${info.modalidad}` : ""}` : "Tu OCD en preparación" }),
        el("span", { className: "prog-pct", textContent: `${pct}%` })),
      el("div", { className: "prog-barra", role: "progressbar", ariaValueNow: String(pct), ariaValueMin: "0", ariaValueMax: "100" }, Object.assign(el("i"), { style: `width:${pct}%` })),
      el("ol", { className: "prog-req", ariaLabel: "Requisitos" }, REQ.map(([k, n], i) =>
        el("li", { className: iReq < 0 || i < iReq ? "hecho" : i === iReq ? "ahora" : "" }, el("span", { textContent: iReq < 0 || i < iReq ? "✓" : String(i + 1), ariaHidden: "true" }), n))),
      el("p", { className: "prog-est", textContent: etiquetaEstado }));
    root.hidden = false;
  };

  document.addEventListener("ocd:paso", (e) => { if (e.detail === "matricula") info = null; actual = e.detail; pintar(); });
  document.addEventListener("ocd:info", (e) => { info = e.detail; pintar(); });
  document.addEventListener("ocd:fuera", () => { actual = null; pintar(); });
}
if (root) init().catch(() => { root.hidden = true; });
