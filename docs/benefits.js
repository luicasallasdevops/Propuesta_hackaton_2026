// Beneficios y pilares: texto y gráficos hechos con DOM. Las cifras salen de los datos reales de la POC (motor, política, incidentes).
import { assess } from "./engine.mjs";

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const load = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
const root = $("#ben-root");

const PILARES = [
  { i: "📚", c: "c1", t: "Estándares al alcance", r: "Hoy los estándares están repartidos y nadie sabe dónde mirar.", h: "Una sola fuente versionada; el asistente responde y cita el documento exacto.", e: "Pestaña Preguntar" },
  { i: "🛡️", c: "c2", t: "Prevención antes de producción", r: "Los problemas se descubren cuando el pase ya fue rechazado o falló.", h: "Riesgo de 0 a 100, bloqueos duros y acciones preventivas antes de pedir el pase.", e: "Pestaña Validar mi pase" },
  { i: "🧠", c: "c4", t: "Aprender de los incidentes", r: "Los incidentes pasados se repiten porque nadie los consulta.", h: "El historial reciente del servicio sube el riesgo y sugiere qué corregir.", e: "Incidentes en el informe" },
  { i: "🤖", c: "c5", t: "Agentes que actúan solos", r: "Cada revisión depende de que alguien la haga a tiempo.", h: "Un agente en GitHub Actions evalúa, comenta, etiqueta y mueve la tarjeta.", e: "Ticket [Pase] y Actions" },
  { i: "📋", c: "c6", t: "Visibilidad del flujo", r: "Nadie ve de un vistazo cuántos pases están bloqueados o esperando.", h: "Tablero Kanban con el estado de cada pase, sin leer tickets técnicos.", e: "Tablero en GitHub Projects" },
  { i: "🔐", c: "c3", t: "Seguridad por diseño", r: "La automatización no debe abrir nuevos riesgos.", h: "Permisos mínimos, token en entorno protegido, CodeQL y recomendación de GitHub App.", e: "Documento 06" },
];

const ANTES = [
  ["🔎", "Buscar el estándar en varios documentos y preguntar a otros equipos"],
  ["⏳", "Descubrir lo que falta cuando el pase ya fue rechazado"],
  ["🔁", "Repetir los mismos errores de incidentes anteriores"],
  ["🙈", "Sin visión de conjunto del estado de los pases"],
];
const AHORA = [
  ["💬", "Respuesta inmediata con el estándar oficial y su fuente"],
  ["🚦", "Riesgo, bloqueos y acciones claras antes de pedir el pase"],
  ["🧠", "El historial de incidentes se aplica a cada nuevo cambio"],
  ["📋", "Tablero Kanban que se mueve solo, visible para liderazgo"],
];

const CRITERIOS = [
  ["🤖", "IA agéntica", "El agente actúa ante eventos: lee, decide, comenta, etiqueta y mueve tarjetas."],
  ["✨", "Prototipo y experiencia", "Portal con guía visual de 10 pasos, chat, validador, pase OCD con calendario y tablero."],
  ["📈", "Impacto en ingeniería y negocio", "Menos rechazos y fallos; más visibilidad para liderazgo."],
  ["💡", "Innovación y diferenciación", "Conocimiento + historial de incidentes + agente + Kanban en un solo flujo."],
  ["🧱", "Factibilidad y escalabilidad", "Solo GitHub; otras áreas cambian su carpeta de conocimiento."],
];
const BONUS = [
  ["⚡", "Productividad en el SDLC", "Evidencias y riesgo se revisan en segundos, no en idas y vueltas."],
  ["🛑", "Menos riesgo en producción", "Los pases bloqueados no avanzan; los incidentes previos pesan."],
  ["🏢", "Reutilización entre tribus", "Misma plataforma; cada tribu con su política y su conocimiento."],
  ["📅", "Implementable en 6 meses o menos", "La base funciona hoy; falta conectar fuentes reales."],
  ["😀", "NPS de servicios CIO", "Una puerta de entrada clara, rápida y con estado visible."],
];

const FCOLORS = ["f1", "f2", "f3", "f4", "f5", "f6"];

function caso(policy, incidents, nombre, icono, cfg) {
  const checks = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, cfg.todos]));
  const r = assess({ servicio: "pagos-api", criticidad: "Alta", dia: cfg.dia, rollback: cfg.rollback, checks }, incidents, policy);
  const total = r.factors.reduce((a, f) => a + f.pts, 0) || 1;
  const top = r.factors.slice(0, 5);
  const rest = r.factors.slice(5).reduce((a, f) => a + f.pts, 0);
  const parts = rest ? [...top, { label: `Otros ${r.factors.length - 5} factores`, pts: rest }] : top;
  const bar = el("div", { className: "stack", role: "img", ariaLabel: `Composición del riesgo de ${nombre}` });
  parts.forEach((f, i) => {
    const seg = el("i", { className: FCOLORS[i % FCOLORS.length], title: `${f.label}: +${f.pts}` });
    seg.style.width = `${(f.pts / total) * 100}%`;
    bar.append(seg);
  });
  const meter = el("div", { className: "meter big" }, el("i"));
  meter.firstChild.style.width = `${r.score}%`;
  meter.firstChild.className = r.estado === "Bloqueado" ? "bad" : "ok";
  return el("div", { className: `case ${r.estado === "Bloqueado" ? "is-bad" : "is-ok"}` },
    el("h3", {}, `${icono} ${nombre}`),
    el("p", { className: "big-num" }, el("strong", { textContent: String(r.score) }), el("span", { textContent: " / 100" }), " ",
      el("span", { className: `pill ${r.estado === "Bloqueado" ? "bad" : "ok"}`, textContent: `${r.nivel}` })),
    meter,
    el("p", { className: "case-st", textContent: `${r.estado === "Bloqueado" ? "⛔" : "✅"} ${r.estado}${r.blockers.length ? ` · ${r.blockers.length} bloqueo(s)` : ""}` }),
    el("p", { className: "muted small", textContent: "De dónde sale el riesgo:" }),
    bar,
    el("ul", { className: "legend" }, parts.map((f, i) => el("li", {}, el("i", { className: FCOLORS[i % FCOLORS.length] }), ` ${f.label} `, el("b", { textContent: `+${f.pts}` })))),
    total > 100 ? el("p", { className: "muted small", textContent: `Suma ${total} puntos; el puntaje máximo es 100.` }) : "");
}

const card = (c, i, t, extra) => el("div", { className: `pil ${c}` }, el("div", { className: "pil-ico", textContent: i, ariaHidden: "true" }), el("h3", { textContent: t }), extra);

async function main() {
  const [policy, incidents, kb, tpl] = await Promise.all(["policy.json", "incidents.json", "kb.json", "templates.json"].map(load));
  const nControles = Object.keys(policy.controles).length;
  const nBloqueos = Object.values(policy.controles).filter((c) => c.bloquea).length + 1;
  const nums = [
    ["🧱", String(nBloqueos), "bloqueos duros que frenan un pase"],
    ["✅", String(nControles), "controles y evidencias revisados"],
    ["🧠", String(incidents.length), "incidentes que enseñan al agente"],
    ["📚", String(Array.isArray(kb) ? kb.length : Object.keys(kb).length), "documentos de estándares"],
    ["📦", String(Array.isArray(tpl) ? tpl.length : Object.keys(tpl).length), "plantillas seguras listas"],
    ["🎚️", String(policy.niveles.length), "niveles de riesgo con su aprobación"],
  ];

  root.replaceChildren(
    el("div", { className: "hero2 ben" },
      el("div", { className: "hero-txt" },
        el("p", { className: "eyebrow", textContent: "🎯 Beneficios y pilares" }),
        el("h2", { textContent: "Por qué esto vale la pena en un banco" }),
        el("p", { className: "lead", textContent: "El reto: anticiparse a los problemas antes de que ocurran. Esta solución ataca el origen: que los equipos descubran tarde lo que les falta para llegar a producción." }),
        el("ul", { className: "kpis" },
          el("li", {}, "🛡️ Menos riesgo"), el("li", {}, "⏱️ Más velocidad"), el("li", {}, "👔 Más visibilidad"), el("li", {}, "🔁 Reutilizable")))),

    el("section", { className: "ben-sec" },
      el("h2", { textContent: "🏛️ Los 6 pilares que abordamos" }),
      el("div", { className: "pil-grid" }, PILARES.map((p) => card(p.c, p.i, p.t, [
        el("p", { className: "pil-r" }, el("b", { textContent: "El reto: " }), p.r),
        el("p", {}, el("b", { textContent: "Qué hacemos: " }), p.h),
        el("p", { className: "chip-l" }, el("span", { className: "chip", textContent: `👀 ${p.e}` })),
      ])))),

    el("section", { className: "ben-sec" },
      el("h2", { textContent: "📊 Un mismo servicio, dos resultados" }),
      el("p", { className: "muted", textContent: "Calculado ahora mismo con el motor del agente (pagos-api, criticidad Alta). El riesgo del camino feliz baja con el tiempo, cuando los incidentes antiguos dejan de contar." }),
      el("div", { className: "grid2" },
        caso(policy, incidents, "Sin preparar", "🚨", { dia: "Viernes", rollback: "No", todos: false }),
        caso(policy, incidents, "Bien preparado", "✅", { dia: "Martes", rollback: "Sí, probado", todos: true }))),

    el("section", { className: "ben-sec" },
      el("h2", { textContent: "🔄 Antes y con el asistente" }),
      el("div", { className: "grid2" },
        el("div", { className: "vs before" }, el("h3", { textContent: "😓 Antes" }), el("ul", {}, ANTES.map(([i, t]) => el("li", {}, el("span", { textContent: i, ariaHidden: "true" }), ` ${t}`)))),
        el("div", { className: "vs after" }, el("h3", { textContent: "😀 Con el asistente" }), el("ul", {}, AHORA.map(([i, t]) => el("li", {}, el("span", { textContent: i, ariaHidden: "true" }), ` ${t}`)))))),

    el("section", { className: "ben-sec" },
      el("h2", { textContent: "🧮 El agente en números" }),
      el("p", { className: "muted", textContent: "Cifras leídas de los datos del proyecto." }),
      el("div", { className: "nums" }, nums.map(([i, n, t]) => el("div", { className: "num-card" }, el("span", { className: "num-i", textContent: i, ariaHidden: "true" }), el("strong", { textContent: n }), el("span", { textContent: t }))))),

    el("section", { className: "ben-sec" },
      el("h2", { textContent: "🏆 Cómo cubrimos los criterios del reto" }),
      el("div", { className: "crit" }, CRITERIOS.map(([i, t, d]) => el("div", { className: "crit-c" }, el("span", { className: "crit-i", textContent: i, ariaHidden: "true" }), el("div", {}, el("h3", { textContent: t }), el("p", { textContent: d }))))),
      el("h3", { className: "bonus-h", textContent: "⭐ Bonificación estratégica" }),
      el("div", { className: "crit bonus" }, BONUS.map(([i, t, d]) => el("div", { className: "crit-c" }, el("span", { className: "crit-i", textContent: i, ariaHidden: "true" }), el("div", {}, el("h3", { textContent: t }), el("p", { textContent: d })))))),

    el("p", { className: "muted small disc", textContent: "Los beneficios son objetivos: se cuantifican con la línea base del equipo (tiempo de pase, rechazos, incidentes evitados)." }),
  );
}

if (root) main().catch((e) => root.replaceChildren(el("p", { className: "muted", textContent: `No pude cargar esta sección (${e.message}).` })));
