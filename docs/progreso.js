// Panel de progreso: solo aparece mientras el asistente guía la creación de un OCD.
// Dos fases: Requisitos (matrícula, grupos, historia, modalidad, datos), que se marca en verde y se colapsa al completarse, y OCD (sus estados). Otras preguntas no lo muestran.
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

  let reqAbierto = null; // null = automático (abierto mientras faltan requisitos, colapsado al completarlos)
  const pintar = () => {
    if (!actual) { root.hidden = true; root.parentElement?.style.removeProperty("--prog-h"); return; }
    const iReq = REQ.findIndex(([k]) => k === actual);
    const iEst = estados.findIndex((e) => e.id === actual);
    const enRama = ramas.has(actual);
    const reqCompletos = iReq < 0;
    const reqHechos = reqCompletos ? REQ.length : iReq;
    const pctReq = Math.round((reqHechos / REQ.length) * 100);
    const estHechos = reqCompletos ? (iEst >= 0 ? iEst : estados.length - 1) : 0;
    const pctOcd = reqCompletos ? Math.round((estHechos / (estados.length - 1)) * 100) : 0;
    const abierto = reqAbierto ?? !reqCompletos;
    const etiquetaEstado = iEst >= 0 ? "" : enRama ? `Rama: ${ramas.get(actual)}` : "El OCD se crea al terminar los requisitos";
    const barra = (pct, ok) => el("div", { className: `prog-barra${ok ? " ok" : ""}`, role: "progressbar", ariaValueNow: String(pct), ariaValueMin: "0", ariaValueMax: "100" }, Object.assign(el("i"), { style: `width:${pct}%` }));

    const fase1 = el("details", { className: `prog-fase${reqCompletos ? " completa" : ""}`, open: abierto, ontoggle: (e) => { if (e.target.open !== abierto) reqAbierto = e.target.open; } },
      el("summary", {},
        el("span", { className: "prog-ico", textContent: reqCompletos ? "✓" : "1", ariaHidden: "true" }),
        el("strong", { textContent: reqCompletos ? "Requisitos completos" : "Requisitos" }),
        el("span", { className: "prog-pct", textContent: `${reqHechos}/${REQ.length}` })),
      barra(pctReq, reqCompletos),
      el("ol", { className: "prog-req", ariaLabel: "Requisitos" }, REQ.map(([k, n], i) => {
        const hecho = reqCompletos || i < iReq;
        return el("li", { className: hecho ? "hecho" : i === iReq ? "ahora" : "" }, el("span", { textContent: hecho ? "✓" : String(i + 1), ariaHidden: "true" }), n);
      })));

    const titulo = info?.key ? `${info.key}${info.servicio ? ` · ${info.servicio}` : ""}${info.modalidad ? ` · ${info.modalidad}` : ""}` : "OCD";
    const fase2 = el("div", { className: `prog-fase ocd${reqCompletos ? "" : " espera"}` },
      el("div", { className: "prog-cab" },
        el("span", { className: "prog-ico", textContent: "2", ariaHidden: "true" }),
        el("strong", { textContent: titulo }),
        el("span", { className: "prog-pct", textContent: reqCompletos ? `${pctOcd}%` : "Pendiente" })),
      barra(pctOcd, false),
      el("ol", { className: "prog-est-l", ariaLabel: "Estados del OCD" }, estados.map((e, i) =>
        el("li", { className: reqCompletos && i < estHechos ? "hecho" : reqCompletos && i === iEst ? "ahora" : "", title: e.nombre }, el("span", { textContent: reqCompletos && i < estHechos ? "✓" : String(i + 1), ariaHidden: "true" }), e.nombre))),
      el("p", { className: "prog-est", textContent: etiquetaEstado }));

    root.replaceChildren(fase1, fase2);
    root.hidden = false;
    root.parentElement?.style.setProperty("--prog-h", `${root.offsetHeight}px`);
  };

  new ResizeObserver(() => { if (!root.hidden) root.parentElement?.style.setProperty("--prog-h", `${root.offsetHeight}px`); }).observe(root);
  document.addEventListener("ocd:paso", (e) => { if (e.detail === "matricula") { info = null; reqAbierto = null; } if (REQ.some(([k]) => k === e.detail)) reqAbierto = null; actual = e.detail; pintar(); });
  document.addEventListener("ocd:info", (e) => { info = e.detail; pintar(); });
  document.addEventListener("ocd:fuera", () => { actual = null; pintar(); });
}
if (root) init().catch(() => { root.hidden = true; });
