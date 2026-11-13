// Asistente conversacional del OCD: ofrece ayuda, pide la matrícula, verifica los grupos de red del servicio,
// muestra los aprobadores y revisa el calendario. Todo con datos ficticios y nodos DOM (sin innerHTML).
import { assessOcd, buscarPorMatricula, normalizarMatricula, validarEquipoOcd, proximaVentana, fechaValida, fmtFechaCorta } from "./engine.mjs";

const TIPOS = { estandar: "Estándar", "estándar": "Estándar", normal: "Normal", emergencia: "Emergencia" };
const esPregunta = (t) => /[?¿]/.test(t) || t.length > 60;
const quitarAcentos = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function crearAsistenteOcd({ say, el, dir, cfg, cal, ir }) {
  const HOY = cfg.fechaDemo;
  let st = "idle";
  let d = {};
  const p = (t) => el("p", { textContent: t });
  const lista = (items) => el("ul", {}, items.map((t) => el("li", { textContent: t })));
  const opcion = (etiqueta, valor, accion) => el("button", { type: "button", className: "qr", textContent: etiqueta, onclick: () => { say("user", etiqueta); accion ? accion() : manejar(valor ?? etiqueta); } });
  const opciones = (...b) => el("div", { className: "qrs" }, b);
  const reiniciar = () => { st = "idle"; d = {}; };

  function ofrecer() {
    if (st !== "idle") return;
    st = "oferta";
    say("bot", p("¿Quieres que te ayude a crear el OCD? Con tu matrícula reviso que tengas los grupos de red del servicio y te digo quiénes deben aprobar."),
      opciones(opcion("Sí, ayúdame", "si"), opcion("No, gracias", "no")));
  }

  function iniciar() {
    d = {}; st = "matricula";
    say("bot", p("Perfecto. Empecemos por tu matrícula (formato M-12345). Con ella busco tus grupos de red."),
      p("Para la demo puedes usar una de estas matrículas ficticias:"),
      opciones(...Object.values(dir.usuarios).map((u) => opcion(`${u.matricula} · ${u.nombre.replace(/ \(.*\)/, "")}`, u.matricula))));
  }

  function pedirServicio() {
    st = "servicio";
    say("bot", p(`Hola, ${d.u.nombre.replace(/ \(.*\)/, "")}. ${d.u.detalle}. ¿Para qué servicio es el OCD?`),
      opciones(...Object.keys(dir.servicios).map((s) => opcion(s, s))));
  }

  function revisarGrupos() {
    const eq = validarEquipoOcd({ servicio: d.svc, usuarioId: d.u.id, tipo: "Normal" }, dir, cfg);
    const faltan = eq.grupos.filter((g) => !g.tiene);
    d.faltan = faltan;
    say("bot", p(`Grupos de red que exige ${d.svc} para tu matrícula ${d.u.matricula}:`),
      lista(eq.grupos.map((g) => `${g.tiene ? "✅" : "❌"} ${g.id} · ${g.nombre}`)),
      faltan.length
        ? p(`Te faltan ${faltan.length}. ${dir.solicitudRed.como} Tarda ${dir.solicitudRed.sla}. ${dir.solicitudRed.ayuda} Puedo seguir ayudándote a planificar mientras tanto.`)
        : p("Tienes todos los grupos de red. Podemos seguir."));
    st = "tipo";
    say("bot", p("¿Qué tipo de cambio es?"), opciones(...Object.keys(cfg.tipos).map((t) => opcion(t, t))));
  }

  function pedirFecha() {
    st = "fecha";
    d.sugerida = d.tipo === "Emergencia" ? HOY : proximaVentana(d.tipo, HOY, cfg, cal);
    say("bot", p(`¿Para qué noche? Escribe la fecha como AAAA-MM-DD (martes a jueves).${d.tipo === "Emergencia" ? " Una emergencia se ejecuta ya." : ""}`),
      d.sugerida ? opciones(opcion(`Usar la sugerida: ${fmtFechaCorta(d.sugerida)} (${d.sugerida})`, "sugerida")) : "");
  }

  function resumen() {
    st = "fin";
    const eq = validarEquipoOcd({ servicio: d.svc, usuarioId: d.u.id, tipo: d.tipo }, dir, cfg);
    const checks = Object.fromEntries(["qa", "sast", "sca", "secretos", "aprobacionSquad", "runbook", "monitoreo", "red", "licencias"].map((k) => [k, true]));
    const r = assessOcd({ change: { servicio: d.svc, tipo: d.tipo, criticidad: "Baja", tamano: "Pequeño", rollback: "Sí, probado", checks }, fecha: d.fecha, hora: "22:00", ocdChecks: { comunicacion: true, verificacion: true } }, [], { niveles: [{ hasta: 100, nivel: "Bajo", aprobaciones: [] }], criticidad: {}, tamano: {}, rollback: {}, diasRiesgo: {}, controles: {}, historial: { ventanaDias: 0, puntosPorIncidente: 0, maximo: 0 }, recomendaciones: {}, version: "demo" }, cfg, cal, HOY);
    const noche = r.blockers.length === 0;
    say("bot",
      el("h3", { textContent: "Resumen de tu OCD" }),
      p(`${d.u.nombre.replace(/ \(.*\)/, "")} (${d.u.matricula}) · ${d.svc} · ${d.tipo} · ${d.fecha} (${r.dia})`),
      p(d.faltan.length ? `🌐 Grupos de red: te faltan ${d.faltan.map((g) => g.id).join(", ")}. Pídelos antes de abrir el OCD.` : "🌐 Grupos de red: completos."),
      el("p", { textContent: "👥 Aprobadores de este servicio:" }),
      lista(eq.roles.map((x) => `${x.rol}: ${x.esperadoNombre}`)),
      noche ? el("div", {}, p(`🗓️ La noche del ${d.fecha} sirve. Tu calendario:`), lista(r.plan.filter((x) => x.id !== "agente").map((x) => `${fmtFechaCorta(x.fecha)}${x.hora ? ` ${x.hora}` : ""} · ${x.nombre}`)))
        : el("div", {}, p("🗓️ Esa noche no sirve:"), lista(r.blockers), r.sugerida ? p(`Te sugiero el ${r.sugerida} (${fmtFechaCorta(r.sugerida)}).`) : ""),
      p("Esta revisión cubre grupos de red, aprobadores y calendario. El riesgo completo lo calcula el agente al crear el OCD."),
      opciones(opcion("Abrir el simulador de Jira con mis datos", "", () => { ir({ usuario: d.u.id, servicio: d.svc, tipo: d.tipo, fecha: noche ? d.fecha : r.sugerida || d.fecha }); }),
        opcion("Empezar de nuevo", "nuevo"), opcion("Terminar", "fin")));
  }

  function manejar(texto) {
    const t = String(texto ?? "").trim();
    if (/^(cancelar|salir)$/i.test(t) && st !== "idle") { reiniciar(); say("bot", p("Listo, lo dejamos aquí. Cuando quieras, escribe «ayúdame a crear mi OCD».")); return true; }
    if (st === "idle") {
      if (/ayud\w*.*\bocd\b|\bocd\b.*ayud/.test(quitarAcentos(t))) { iniciar(); return true; }
      return false;
    }
    if (st === "oferta") {
      if (/^(si|sí|claro|dale|ok|vale|ayuda|por favor)\b/i.test(t)) { iniciar(); return true; }
      if (/^no\b/i.test(t)) { reiniciar(); say("bot", p("Sin problema. Cuando quieras, escribe «ayúdame a crear mi OCD».")); return true; }
      reiniciar(); return manejar(t);
    }
    if (st === "fin") {
      if (/^(nuevo|empez)/i.test(t)) { iniciar(); return true; }
      if (/^(fin|terminar)/i.test(t)) { reiniciar(); say("bot", p("¡Éxito con tu OCD! Si te trabas, pregúntame lo que necesites.")); return true; }
      reiniciar(); return manejar(t);
    }
    if (st === "matricula") {
      if (!normalizarMatricula(t)) {
        if (esPregunta(t)) { reiniciar(); return manejar(t); }
        say("bot", p("No reconozco ese formato. La matrícula es una M y cinco dígitos, por ejemplo M-10212.")); return true;
      }
      const u = buscarPorMatricula(dir, t);
      if (!u) { say("bot", p(`No encuentro la matrícula ${normalizarMatricula(t)} en el directorio. Revisa que esté bien escrita o pide tu alta a la mesa de accesos.`)); return true; }
      d.u = u; pedirServicio(); return true;
    }
    if (st === "servicio") {
      const k = Object.keys(dir.servicios).find((s) => quitarAcentos(t).includes(s));
      if (!k) {
        if (esPregunta(t)) { reiniciar(); return manejar(t); }
        say("bot", p(`No conozco ese servicio. Elige uno: ${Object.keys(dir.servicios).join(", ")}.`)); return true;
      }
      d.svc = k; revisarGrupos(); return true;
    }
    if (st === "tipo") {
      const k = Object.keys(TIPOS).find((x) => quitarAcentos(t).includes(quitarAcentos(x)));
      if (!k) {
        if (esPregunta(t)) { reiniciar(); return manejar(t); }
        say("bot", p("Elige el tipo de cambio: Estándar, Normal o Emergencia.")); return true;
      }
      d.tipo = TIPOS[k]; pedirFecha(); return true;
    }
    if (st === "fecha") {
      const m = t.match(/\d{4}-\d{2}-\d{2}/);
      const f = /sugerid|usar/i.test(t) ? d.sugerida : m?.[0];
      if (!f || !fechaValida(f)) {
        if (esPregunta(t) && !m) { reiniciar(); return manejar(t); }
        say("bot", p("No pude leer esa fecha. Usa el formato AAAA-MM-DD, por ejemplo 2026-11-24, o pulsa la sugerida.")); return true;
      }
      d.fecha = f; resumen(); return true;
    }
    return false;
  }

  return { ofrecer, iniciar, manejar, get activo() { return st !== "idle"; } };
}
