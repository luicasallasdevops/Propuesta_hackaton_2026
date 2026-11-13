// Pase OCD: planificador con calendario y aprobadores, noches de ventana, tablero Kanban simulado y simulador paso a paso.
// Todo se construye con nodos DOM y textContent (sin innerHTML) y usa los datos ficticios de knowledge/.
import { assessOcd, planOcd, ventanasProximas, diaDe } from "./engine.mjs";
import { montarJira } from "./jira.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};
const load = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
const root = $("#ocd-root");
if (root) init().catch((e) => root.replaceChildren(el("p", { className: "muted", textContent: `No pude cargar el módulo OCD (${e.message}).` })));

const FALLBACK_REPO = "hybridcloudcompany/Grupo11";
const repo = (() => {
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  const name = location.pathname.split("/")[1];
  return m && name ? `${m[1]}/${name}` : FALLBACK_REPO;
})();
const ocdUrl = (o) => `https://github.com/${repo}/issues/new?${new URLSearchParams({ template: "ocd.yml", title: `[OCD] ${o.servicio} (demo)`, servicio: o.servicio, fecha: o.fecha || "", hora: o.hora || "" })}`;
const fmtFecha = (s) => { const d = diaDe(s); return s ? `${d.slice(0, 3)} ${s.slice(8)}/${s.slice(5, 7)}` : "—"; };

const COLUMNAS = [["Solicitado", "📥", "k1"], ["Bloqueado", "🚨", "k2"], ["Listo para aprobaciones", "✅", "k3"], ["Aprobado", "🔐", "k4"], ["En producción", "🚀", "k5"]];
const ICONO_APROB = { ok: "✅", pendiente: "⏳", "a posteriori": "🕓" };
const RECORRIDO = [
  ["🌐", "Verifica tus grupos de red", "Cada servicio exige los suyos. Pídelos con 3 días hábiles de anticipación."],
  ["📚", "Reúne evidencias", "QA, SAST, SCA, secretos, runbook y rollback probado."],
  ["🗓️", "Elige la noche", "Martes a jueves, 22:00 a 04:00, con cupo libre."],
  ["📝", "Crea el OCD en Jira", "Con fecha, hora y aprobadores. El agente responde al instante."],
  ["👥", "Consigue aprobaciones", "Líder técnico, Product Owner, Seguridad y Change Management (CAB)."],
  ["🚀", "Ejecuta y verifica", "Workflow protegido, 30 minutos de métricas y cierre con evidencia."],
];
const TEXTO_ETAPA = {
  crear: "Se abre el ticket con las evidencias. La tarjeta nace en Solicitado.",
  agente: "El agente calcula riesgo, calendario y aprobadores, y mueve la tarjeta a Listo para aprobaciones.",
  lider: "El líder técnico confirma que el cambio es correcto y reversible.",
  seguridad: "Seguridad revisa SAST, SCA, secretos y accesos antes del CAB.",
  cab: "Change Management aprueba en el CAB: la tarjeta pasa a Aprobado.",
  agenda: "Se confirma la ventana y se avisa a las áreas impactadas.",
  ejecutar: "Empieza la ventana: se ejecuta el workflow protegido y la tarjeta pasa a En producción.",
  verificar: "Se vigilan métricas y alertas durante 30 minutos. Si algo falla, se ejecuta el rollback.",
  cerrar: "Se cierra el OCD con la evidencia de la verificación.",
  posteriori: "Seguridad y Change Management aprueban a posteriori, en máximo 24 horas.",
};

async function init() {
  const [cfg, cal, policy, incidents, dir, historias, flujo] = await Promise.all(["ocd.json", "ocd-calendario.json", "policy.json", "incidents.json", "ocd-directorio.json", "ocd-historias.json", "ocd-flujo.json"].map(load));
  const HOY = cfg.fechaDemo;
  const porId = (id) => cal.find((c) => c.id === id);
  const checksDe = (f) => Object.fromEntries(Object.keys(policy.controles).map((k) => [k, !f.faltan.includes(k)]));
  const entradaDe = (x) => ({ id: x.id, change: { servicio: x.servicio, tipo: x.tipo, criticidad: x.form.criticidad, tamano: x.form.tamano, rollback: x.form.rollback, checks: checksDe(x.form) }, fecha: x.fecha, hora: x.hora, ocdChecks: { comunicacion: x.form.comunicacion, verificacion: x.form.verificacion } });
  const evaluar = (x, hoy) => assessOcd(entradaDe(x), incidents, policy, cfg, cal, hoy);

  /* ---------- Planificador ---------- */
  const form = el("form", { className: "card", id: "ocd-form" });
  const campo = (rotulo, control) => el("label", {}, rotulo, " ", control);
  const sel = (name, opts) => el("select", { name }, opts.map((o) => el("option", { textContent: o })));
  const svc = el("input", { name: "servicio", value: "core-cuentas", required: true, maxLength: 80 });
  svc.setAttribute("list", "ocd-svc");
  const checks = el("div", { id: "ocd-checks" });
  for (const [k, c] of Object.entries(policy.controles)) checks.append(el("label", {}, el("input", { type: "checkbox", name: k }), c.etiqueta));
  for (const [k, c] of Object.entries(cfg.controles)) checks.append(el("label", { className: "ocd-extra" }, el("input", { type: "checkbox", name: `ocd_${k}` }), c.etiqueta));
  form.append(
    el("h2", { textContent: "📅 Planifica tu OCD" }),
    campo("Servicio", svc),
    el("datalist", { id: "ocd-svc" }, ["pagos-api", "canal-web", "core-cuentas", "tarjetas-api", "notificaciones"].map((v) => el("option", { value: v }))),
    el("div", { className: "row" }, campo("Tipo de cambio", sel("tipo", Object.keys(cfg.tipos))), campo("Criticidad", sel("criticidad", ["Alta", "Media", "Baja"]))),
    el("div", { className: "row" }, campo("Tamaño", sel("tamano", ["Pequeño", "Mediano", "Grande"])), campo("Rollback", sel("rollback", ["Sí, probado", "Sí, sin probar", "No"]))),
    el("div", { className: "row" }, campo("Fecha de ejecución", el("input", { name: "fecha", type: "date", required: true })), campo("Hora de inicio", el("input", { name: "hora", type: "time", value: "22:00", required: true }))),
    campo("Hoy (fecha de referencia)", el("input", { name: "hoy", type: "date", value: HOY, required: true })),
    el("fieldset", {}, el("legend", { textContent: "Evidencias y requisitos que ya tengo" }), checks),
    el("button", { type: "submit", textContent: "Calcular calendario y aprobadores" }));
  const salida = el("div", { id: "ocd-resultado", className: "card", ariaLive: "polite" },
    el("p", { className: "muted", textContent: "Carga un caso de ejemplo o completa el formulario. El agente te dirá si la noche sirve, quién debe aprobar y en qué fecha tienes que hacer cada paso." }));

  function cargar(v) {
    for (const k of ["servicio", "tipo", "criticidad", "tamano", "rollback", "fecha", "hora", "hoy"]) if (v[k] !== undefined) form.elements[k].value = v[k];
    for (const k of Object.keys(policy.controles)) form.elements[k].checked = !v.faltan?.includes(k);
    for (const k of Object.keys(cfg.controles)) form.elements[`ocd_${k}`].checked = v[k] !== false;
    form.requestSubmit();
  }
  const preset = (f) => ({ ...f, hoy: HOY, hora: f.hora ?? "22:00", faltan: f.faltan ?? [] });
  const CASOS = [
    ["✅ OCD listo", preset({ servicio: "core-cuentas", tipo: "Normal", criticidad: "Media", tamano: "Pequeño", rollback: "Sí, probado", fecha: "2026-11-24" })],
    ["🈵 Noche llena", preset({ servicio: "notificaciones", tipo: "Estándar", criticidad: "Baja", tamano: "Pequeño", rollback: "Sí, probado", fecha: "2026-11-18", hora: "23:30" })],
    ["🛑 Viernes sin rollback", preset({ servicio: "pagos-api", tipo: "Normal", criticidad: "Alta", tamano: "Grande", rollback: "No", fecha: "2026-11-20", faltan: Object.keys(policy.controles), comunicacion: false, verificacion: false })],
    ["🧊 En congelamiento", preset({ servicio: "canal-web", tipo: "Normal", criticidad: "Media", tamano: "Pequeño", rollback: "Sí, probado", fecha: "2026-11-26" })],
    ["🚑 Emergencia", preset({ servicio: "notificaciones", tipo: "Emergencia", criticidad: "Alta", tamano: "Pequeño", rollback: "Sí, probado", fecha: "2026-11-27", hora: "03:00", faltan: ["runbook"] })],
  ];
  const chips = el("div", { className: "chips" }, CASOS.map(([t, v]) => el("button", { type: "button", textContent: t, onclick: () => cargar(v) })));

  const lista = (items, tag = "ul") => el(tag, {}, items.map((t) => el("li", { textContent: t })));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const o = {
      change: { servicio: String(f.get("servicio")).trim().slice(0, 80), tipo: f.get("tipo"), criticidad: f.get("criticidad"), tamano: f.get("tamano"), rollback: f.get("rollback"),
        checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, f.get(k) === "on"])) },
      fecha: String(f.get("fecha")), hora: String(f.get("hora")),
      ocdChecks: Object.fromEntries(Object.keys(cfg.controles).map((k) => [k, f.get(`ocd_${k}`) === "on"])),
    };
    const hoy = String(f.get("hoy")) || HOY;
    const r = assessOcd(o, incidents, policy, cfg, cal, hoy);
    const color = r.estado === "Bloqueado" ? "bad" : r.score < 30 ? "ok" : "warn";
    const meter = el("div", { className: "meter", role: "img", ariaLabel: `Riesgo ${r.score} de 100` }, el("i"));
    meter.firstChild.style.setProperty("width", `${r.score}%`);
    meter.firstChild.style.setProperty("background", `var(--${color})`);
    salida.replaceChildren(el("div", { className: "res" },
      el("h2", { textContent: `Resultado para ${o.change.servicio}` }),
      el("div", { className: "score" }, el("span", { className: `pill ${color}`, textContent: r.estado }), meter, el("strong", { textContent: `${r.nivel} · ${r.score}/100` })),
      el("p", { className: "muted", textContent: `Ejecución: ${r.dia || "—"} ${o.fecha || ""} ${o.hora || ""} · tipo ${r.tipoEfectivo || o.change.tipo}` }),
      r.blockers.length ? [el("h3", { textContent: "🛑 Bloqueos" }), lista(r.blockers)] : "",
      r.advertencias.length ? [el("h3", { textContent: "⚠️ Advertencias" }), lista(r.advertencias)] : "",
      r.actions.length ? [el("h3", { textContent: "🧭 Qué hacer ahora" }), lista(r.actions, "ol")] : "",
      r.plan.length ? [el("h3", { textContent: "🗓️ Tu calendario" }), el("ol", { className: "tl" }, r.plan.map((p) =>
        el("li", { className: p.vencida ? "late" : "" },
          el("span", { className: "tl-d", textContent: `${fmtFecha(p.fecha)}${p.hora ? ` ${p.hora}` : ""}` }),
          el("span", { className: "tl-t" }, el("strong", { textContent: p.nombre }), el("small", { textContent: ` · ${p.responsable}${p.vencida ? " · ⚠️ ya venció" : ""}` })))))] : "",
      el("h3", { textContent: "👥 Aprobadores" }), lista(r.aprobadores),
      el("p", { className: "muted", textContent: r.sugerida ? `Primera noche disponible: ${fmtFecha(r.sugerida)} (${r.sugerida}).` : "" }),
      el("p", {}, el("a", { className: "btn", href: ocdUrl({ servicio: o.change.servicio, fecha: o.fecha, hora: o.hora }), target: "_blank", rel: "noopener", textContent: "Abrir este OCD en GitHub ↗" }))));
  });

  /* ---------- Noches de la ventana ---------- */
  const noches = ventanasProximas(HOY, cfg, cal, 8);
  const nochesBox = el("div", { className: "nights" }, noches.map((n) => {
    const pct = Math.min(100, Math.round((n.ids.length / n.max) * 100));
    const barra = el("div", { className: "meter" }, el("i"));
    barra.firstChild.style.setProperty("width", `${n.motivo ? 100 : pct}%`);
    barra.firstChild.style.setProperty("background", n.estado === "libre" ? "var(--ok)" : n.estado === "llena" ? "var(--bad)" : "var(--mut)");
    return el("div", { className: `night ${n.estado}` },
      el("strong", { textContent: fmtFecha(n.fecha) }),
      barra,
      el("small", { textContent: n.motivo ? `🧊 ${n.motivo}` : `${n.ids.length} de ${n.max} OCD${n.ids.length ? ` · ${n.ids.join(", ")}` : ""}` }),
      el("span", { className: `pill ${n.estado === "libre" ? "ok" : n.estado === "llena" ? "bad" : "muted"}`, textContent: n.estado === "libre" ? "Con cupo" : n.estado === "llena" ? "Llena" : "Cerrada" }));
  }));

  /* ---------- Tablero Kanban simulado ---------- */
  const detalle = el("div", { className: "card detalle", ariaLive: "polite" }, el("p", { className: "muted", textContent: "Toca una tarjeta para ver sus aprobaciones y su calendario." }));
  const tarjeta = (x, activa = false) => {
    const b = el("button", { type: "button", className: `kcard${activa ? " activa" : ""}` },
      el("strong", { textContent: x.id }), el("span", { textContent: x.servicio }),
      el("small", { textContent: `${x.tipo} · ${fmtFecha(x.fecha)} ${x.hora}` }));
    b.addEventListener("click", () => mostrar(x));
    return b;
  };
  const tablero = el("div", { className: "kanban" }, COLUMNAS.map(([nombre, ico, k]) => {
    const items = cal.filter((c) => c.estado === nombre);
    return el("section", { className: `kcol ${k}` }, el("h3", {}, `${ico} ${nombre} `, el("span", { className: "kn", textContent: String(items.length) })), items.map((x) => tarjeta(x)));
  }));
  function mostrar(x) {
    const r = evaluar(x, x.creado);
    detalle.replaceChildren(
      el("h3", { textContent: `${x.id} · ${x.servicio}` }),
      el("p", { textContent: `${x.resumen} Solicitante: ${x.solicitante}.` }),
      el("p", { className: "muted", textContent: `${x.tipo} · ejecución ${fmtFecha(x.fecha)} ${x.hora} · riesgo ${r.nivel} (${r.score}/100) · columna ${x.estado}` }),
      el("ul", { className: "aprob" }, Object.entries(x.aprobaciones).map(([k, v]) => el("li", { textContent: `${ICONO_APROB[v] || "•"} ${k}: ${v}` }))),
      r.blockers.length ? el("p", { className: "bloq", textContent: `🛑 ${r.blockers.join(" · ")}` }) : "",
      el("button", { type: "button", className: "btn ghost", textContent: "Cargar en el planificador", onclick: () => { cargar({ servicio: x.servicio, tipo: x.tipo, criticidad: x.form.criticidad, tamano: x.form.tamano, rollback: x.form.rollback, fecha: x.fecha, hora: x.hora, hoy: x.creado, faltan: x.form.faltan, comunicacion: x.form.comunicacion, verificacion: x.form.verificacion }); form.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
  }

  /* ---------- Simulador paso a paso ---------- */
  const ESCENARIOS = {
    feliz: { titulo: "✅ OCD Normal sin tropiezos (OCD-2003)", pasos: () => {
      const x = porId("OCD-2003");
      return planOcd("Normal", x.fecha, cfg, x.hora).map((p) => ({ col: p.id === "crear" ? "Solicitado" : p.columna, titulo: `${fmtFecha(p.fecha)} · ${p.nombre}`, texto: `${TEXTO_ETAPA[p.id]} Responsable: ${p.responsable}.`, id: x.id }));
    } },
    bloqueado: { titulo: "🛑 OCD bloqueado que se corrige (OCD-2005)", pasos: () => {
      const x = porId("OCD-2005");
      const r0 = evaluar(x, x.creado);
      const corregido = { ...entradaDe(x), change: { ...entradaDe(x).change, rollback: "Sí, probado", tamano: "Mediano", checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, true])) }, fecha: r0.sugerida, hora: "22:00", ocdChecks: { comunicacion: true, verificacion: true } };
      const r1 = assessOcd(corregido, incidents, policy, cfg, cal, x.creado);
      return [
        { col: "Solicitado", titulo: `${fmtFecha(x.creado)} · Sofía crea el OCD`, texto: `Pide ejecutar el viernes ${x.fecha}, con rollback No y sin SAST ni SCA.` },
        { col: "Bloqueado", titulo: "El agente lo bloquea al instante", texto: `${r0.nivel} (${r0.score}/100). Bloqueos: ${r0.blockers.join("; ")}.` },
        { col: "Bloqueado", titulo: "El agente propone cómo corregirlo", texto: r0.actions.slice(0, 3).join(" ") },
        { col: "Listo para aprobaciones", titulo: "Sofía corrige y edita el ticket", texto: `Nueva fecha ${r0.sugerida}, rollback probado y evidencias completas. Estado: ${r1.estado}, riesgo ${r1.nivel} (${r1.score}/100). Aprobadores: ${r1.aprobadores.join(", ")}.` },
        { col: "Aprobado", titulo: "Líder técnico, Seguridad y Change Management aprueban", texto: "La tarjeta pasa a Aprobado y se confirma la ventana." },
        { col: "En producción", titulo: "Se ejecuta en la ventana y se verifica", texto: "Se despliega con el workflow protegido y se vigila 30 minutos." },
      ].map((p) => ({ ...p, id: x.id }));
    } },
    emergencia: { titulo: "🚑 Emergencia (OCD-2007)", pasos: () => {
      const x = porId("OCD-2007");
      return planOcd("Emergencia", x.fecha, cfg, x.hora).map((p) => ({ col: ["crear", "agente", "lider"].includes(p.id) ? "Listo para aprobaciones" : "En producción", titulo: `${fmtFecha(p.fecha)}${p.hora ? ` ${p.hora}` : ""} · ${p.nombre}`, texto: `${TEXTO_ETAPA[p.id]} Responsable: ${p.responsable}.`, id: x.id }));
    } },
  };
  const selSim = el("select", { ariaLabel: "Escenario" }, Object.entries(ESCENARIOS).map(([k, v]) => el("option", { value: k, textContent: v.titulo })));
  const mini = el("div", { className: "kanban mini" });
  const narra = el("div", { className: "narra" });
  const contador = el("span", { className: "chip" });
  let pasos = [], i = 0;
  const pintar = () => {
    const p = pasos[i];
    mini.replaceChildren(...COLUMNAS.map(([nombre, ico, k]) => el("section", { className: `kcol ${k}${nombre === p.col ? " ahora" : ""}` },
      el("h3", { textContent: `${ico} ${nombre}` }),
      nombre === p.col ? el("div", { className: "kcard activa" }, el("strong", { textContent: p.id }), el("small", { textContent: "tarjeta aquí" })) : "")));
    narra.replaceChildren(el("h3", { textContent: p.titulo }), el("p", { textContent: p.texto }));
    contador.textContent = `Paso ${i + 1} de ${pasos.length}`;
    ant.disabled = i === 0; sig.disabled = i === pasos.length - 1;
  };
  const ant = el("button", { type: "button", className: "btn ghost", textContent: "◀ Anterior", onclick: () => { i = Math.max(0, i - 1); pintar(); } });
  const sig = el("button", { type: "button", className: "btn", textContent: "Siguiente ▶", onclick: () => { i = Math.min(pasos.length - 1, i + 1); pintar(); } });
  const elegir = () => { pasos = ESCENARIOS[selSim.value].pasos(); i = 0; pintar(); };
  selSim.addEventListener("change", elegir);

  /* ---------- Montaje ---------- */
  root.replaceChildren(
    el("div", { className: "hero2 ocd-hero" },
      el("div", { className: "hero-txt" },
        el("p", { className: "eyebrow", textContent: "📅 Pase a producción tipo OCD" }),
        el("h2", { textContent: "Crea y ejecuta tu OCD sin dolores de cabeza" }),
        el("p", { className: "lead", textContent: "El agente calcula en qué noche puedes ejecutar, qué día debes hacer cada paso, quién tiene que aprobar y si hay cupo en la ventana. Tú solo sigues el calendario." }),
        el("ul", { className: "kpis" },
          el("li", {}, el("span", { textContent: "👥", ariaHidden: "true" }), " Líder técnico, Seguridad y Change Management"),
          el("li", {}, el("span", { textContent: "🌙", ariaHidden: "true" }), " Ventana martes a jueves, 22:00 a 04:00"),
          el("li", {}, el("span", { textContent: "🤖", ariaHidden: "true" }), " Fechas calculadas por el agente"))),
      el("div", { className: "hero-prog" }, el("div", { className: "ocd-big", textContent: "OCD" }), el("p", { className: "hero-msg", textContent: "Pase con calendario" }))),
    el("h2", { className: "sec", textContent: "🧭 Tu recorrido en 6 pasos" }),
    el("ol", { className: "steps6" }, RECORRIDO.map(([ico, t, d], n) => el("li", {}, el("span", { className: "s6-i", textContent: ico }), el("strong", { textContent: `${n + 1}. ${t}` }), el("small", { textContent: d })))),
    el("h2", { className: "sec", textContent: "🎫 Crea tu primer OCD en Jira" }),
    montarJira({ cfg, cal, policy, incidents, dir, hoy: HOY, historias, flujo }),
    el("h2", { className: "sec", textContent: "🛠️ Planificador rápido de fechas" }),
    chips,
    el("div", { className: "grid2" }, form, salida),
    el("h2", { className: "sec", textContent: "🌙 Noches de la ventana (cupo máximo 3)" }),
    nochesBox,
    el("p", { className: "muted", textContent: `Fecha de referencia: ${HOY}.` }),
    el("h2", { className: "sec", textContent: "📋 Tablero Kanban con OCD de ejemplo" }),
    tablero, detalle,
    el("h2", { className: "sec", textContent: "🎬 Cómo se mueve un OCD por el tablero" }),
    el("div", { className: "sim-bar" }, selSim, contador, ant, sig),
    mini, el("div", { className: "card" }, narra),
    el("div", { className: "card cta" }, el("h2", { textContent: "¿Quieres ver al agente real?" }),
      el("p", { textContent: "El formulario crea un Issue [OCD] y en unos 20 segundos el agente publica el informe y mueve la tarjeta del tablero." }),
      el("a", { className: "btn", href: ocdUrl({ servicio: "core-cuentas", fecha: "2026-11-24", hora: "22:00" }), target: "_blank", rel: "noopener", textContent: "Probar el agente real en GitHub ↗" })));
  cargar(CASOS[0][1]);
  elegir();
}
