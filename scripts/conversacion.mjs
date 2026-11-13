// Comprensión del lenguaje natural del asistente: reglas deterministas (sin LLM), puras y probables.
// Extrae intención y datos («slots») de una frase, los mezcla con el contexto de la conversación y calcula qué falta.
// La capa de lenguaje solo interpreta; el riesgo, el calendario, los permisos y las aprobaciones los sigue validando el motor.

import { assessOcd, proximaVentana, fmtFechaCorta } from "./engine.mjs";

export const quitarAcentos = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DIAS_BONITOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const sumar = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaIdx = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const valida = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; };

/** Fecha mencionada en la frase (ISO) o null. `hoy` es la fecha de referencia AAAA-MM-DD. */
export function fechaDeTexto(texto, hoy) {
  const q = quitarAcentos(texto);
  let m = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m && valida(m[0])) return m[0];
  m = q.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
  if (m) return alAnio(Number(m[1]), MESES.indexOf(m[2]) + 1, hoy);
  m = q.match(/\b(\d{1,2})[/-](\d{1,2})\b(?![/-]\d)/);
  if (m && Number(m[2]) <= 12) return alAnio(Number(m[1]), Number(m[2]), hoy);
  if (/\bpasado manana\b/.test(q)) return sumar(hoy, 2);
  if (/\bmanana\b/.test(q)) return sumar(hoy, 1);
  if (/\bhoy\b/.test(q)) return hoy;
  const dia = DIAS.findIndex((x) => new RegExp(`\\b${x}s?\\b`).test(q));
  if (dia >= 0) {
    let f = sumar(hoy, (dia - diaIdx(hoy) + 7) % 7);
    if (f === hoy && /(proximo|que viene|siguiente)/.test(q)) f = sumar(f, 7);
    return f;
  }
  return null;
}
function alAnio(dia, mes, hoy) {
  const y = Number(hoy.slice(0, 4));
  for (const a of [y, y + 1]) {
    const iso = `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (valida(iso) && iso >= hoy) return iso;
  }
  return null;
}
export const nombreDia = (iso) => DIAS_BONITOS[diaIdx(iso)];

const CONTROLES = [
  [/\b(sast|analisis estatico)\b/, "sast"], [/\b(sca|dependencias vulnerables)\b/, "sca"], [/\b(qa|pruebas)\b/, "qa"],
  [/\b(secretos|escaneo de secretos)\b/, "secretos"], [/\b(monitoreo|alertas)\b/, "monitoreo"], [/\brunbook\b/, "runbook"],
];

/** Datos que se pueden leer de una frase. Solo devuelve lo que realmente aparece. */
export function extraerDatos(texto, { servicios = [], hoy }) {
  const q = quitarAcentos(texto);
  const s = {};
  const svc = servicios.find((x) => q.includes(x) || q.includes(x.replace(/-/g, " ")));
  if (svc) s.servicio = svc;
  const f = fechaDeTexto(q, hoy);
  if (f) s.fecha = f;
  const hora = q.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hora) s.hora = `${hora[1].padStart(2, "0")}:${hora[2]}`;
  if (/(sin|no (tengo|hay|cuento con|existe))\s+(un\s+|el\s+)?(plan\s+de\s+)?(rollback|reversa|reversion|marcha atras)/.test(q) || /(rollback|reversa)\s+no\b/.test(q)) s.rollback = "No";
  else if (/(rollback|reversa|reversion)\s+(ya\s+)?(probad|validad|listo|ensayad)/.test(q) || /(probe|probamos|probado)\s+(el\s+)?(rollback|plan de reversa)/.test(q)) s.rollback = "Sí, probado";
  else if (/(tengo|con|hay|cuento con)\s+(un\s+)?(plan\s+de\s+)?(rollback|reversa)/.test(q)) s.rollback = "Sí, sin probar";
  const crit = q.match(/criticidad\s+(alta|media|baja)/) ?? q.match(/\b(alta|media|baja)\s+criticidad/);
  if (crit) s.criticidad = crit[1][0].toUpperCase() + crit[1].slice(1);
  else if (/(servicio|sistema) critico|muy critico/.test(q)) s.criticidad = "Alta";
  const tam = q.match(/cambio\s+(grande|mediano|pequeno|chico)/) ?? q.match(/\b(grande|pequeno)\b/);
  if (tam) s.tamano = { grande: "Grande", mediano: "Mediano", pequeno: "Pequeño", chico: "Pequeño" }[tam[1]];
  if (/\b(emergencia|urgente|incidente activo)\b/.test(q)) s.tipo = "Emergencia";
  else if (/\bestandar\b/.test(q)) s.tipo = "Estándar";
  else if (/\bnormal\b/.test(q)) s.tipo = "Normal";
  const mod = q.match(/\b(automatizado|manual|hibrido|deploygo)\b/);
  if (mod) s.modalidad = { automatizado: "Automatizado", manual: "Manual", hibrido: "Híbrido", deploygo: "DeployGO" }[mod[1]];
  for (const [re, k] of CONTROLES) if (new RegExp(`\\bsin\\s+(el\\s+|las?\\s+)?(escaneo\\s+de\\s+)?${re.source.replace(/\\b/g, "")}`).test(q)) (s.faltan ??= []).push(k);
  return s;
}

/** Intención general de la frase. */
export function intencion(texto) {
  const q = quitarAcentos(texto).trim();
  if (/^(hola|holi|hey|ey|saludos|buen[oa]s?( (dias|tardes|noches))?|que tal|como estas|como vas)\b/.test(q) && q.length < 45) return "saludo";
  if (/^(muchas )?gracias|\bmil gracias\b|^perfecto,? gracias|^genial,? gracias/.test(q)) return "gracias";
  if (/^(adios|chao|chau|hasta luego|nos vemos|bye)\b/.test(q)) return "adios";
  if (/^(menu|opciones|ayuda|ayudame|inicio|empezar|que puedes hacer|que haces|en que me ayudas|como me ayudas|que sabes hacer)\b/.test(q) || /(que puedes hacer|en que me puedes ayudar|como funcionas)/.test(q)) return "menu";
  if (/(validar|revisar|chequear|evaluar|analizar)\s+(mi|el|este)?\s*(pase|despliegue|cambio)/.test(q)) return "evaluar";
  if (/(desplegar|despliegue|pasar a produccion|pase a produccion|llevar a produccion|subir a produccion|salir a produccion|publicar|necesito pasar|quiero pasar)/.test(q)) return "evaluar";
  return "otra";
}

/** Une datos nuevos al cambio que ya se venía armando. Devuelve el cambio y qué campos cambiaron. */
export function mezclar(cambio = {}, datos = {}) {
  const nuevo = { ...cambio, faltan: [...(cambio.faltan ?? [])] };
  const cambios = [];
  for (const [k, v] of Object.entries(datos)) {
    if (k === "faltan") { for (const c of v) if (!nuevo.faltan.includes(c)) { nuevo.faltan.push(c); cambios.push({ campo: "faltan", de: null, a: c }); } continue; }
    if (nuevo[k] !== v) { cambios.push({ campo: k, de: nuevo[k] ?? null, a: v }); nuevo[k] = v; }
  }
  return { cambio: nuevo, cambios };
}

/** Lo mínimo que hay que preguntar para poder evaluar: servicio, fecha y rollback. */
export function faltantes(cambio = {}) {
  return ["servicio", "fecha", "rollback"].filter((k) => !cambio[k]);
}

/** Respuesta corta a una pregunta concreta («¿tienes rollback?» → «no, aún no»). */
export function respuestaACampo(campo, texto) {
  const q = quitarAcentos(texto).trim();
  if (campo === "rollback") {
    if (/(probad|validad|ensayad)/.test(q)) return { rollback: "Sí, probado" };
    if (/^(no|aun no|todavia no|nop|negativo|sin)\b/.test(q)) return { rollback: "No" };
    if (/^(si|tengo|claro|ya|lo tengo)\b/.test(q)) return { rollback: "Sí, sin probar" };
  }
  return {};
}

export const resumenCambio = (c) => [
  c.servicio && `servicio ${c.servicio}`, c.fecha && `${nombreDia(c.fecha).toLowerCase()} ${c.fecha}${c.hora ? ` ${c.hora}` : ""}`,
  c.rollback && (c.rollback === "No" ? "sin rollback" : `rollback ${c.rollback === "Sí, probado" ? "probado" : "sin probar"}`),
  c.criticidad && `criticidad ${c.criticidad}`, c.tamano && `cambio ${c.tamano.toLowerCase()}`, c.tipo && `tipo ${c.tipo}`,
  c.faltan?.length && `sin ${c.faltan.join(", ")}`,
].filter(Boolean).join(" · ");

/**
 * Evalúa lo que el usuario contó con el motor real (riesgo, calendario, cupo, congelamientos) y arma la traza:
 * qué consultó el agente, qué detectó, qué propone y qué acción puede ejecutar. Lo que el usuario no dijo se supone y se declara.
 */
export function evaluarCambio(cambio, { policy, cfg, cal, incidents, hoy }) {
  const supuestos = [];
  const supone = (k, v, txt) => { if (!cambio[k]) supuestos.push(txt); return cambio[k] ?? v; };
  const tipo = supone("tipo", "Normal", "tipo de cambio Normal");
  const previo = [...cal].reverse().find((c) => c.servicio === cambio.servicio && c.form?.criticidad);
  const criticidad = supone("criticidad", previo?.form.criticidad ?? "Media", `criticidad ${previo?.form.criticidad ?? "Media"}${previo ? " (la de sus OCD anteriores)" : ""}`);
  const tamano = supone("tamano", "Mediano", "cambio de tamaño Mediano");
  const hora = supone("hora", cfg.ventana.horaInicio, `hora ${cfg.ventana.horaInicio}`);
  const faltan = new Set(cambio.faltan ?? []);
  if (!faltan.size) supuestos.push("controles de calidad y seguridad completos (dime si te falta alguno)");
  const checks = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, !faltan.has(k)]));
  const ocdChecks = Object.fromEntries(Object.keys(cfg.controles).map((k) => [k, true]));
  const change = { servicio: cambio.servicio, tipo, criticidad, tamano, rollback: cambio.rollback, checks };
  const r = assessOcd({ change, fecha: cambio.fecha, hora, ocdChecks }, incidents, policy, cfg, cal, hoy);
  const deServicio = incidents.filter((i) => i.servicio === cambio.servicio);
  const noches = cal.filter((c) => c.fecha === cambio.fecha && c.estado !== "Cancelado").length;
  const traza = {
    consulto: [
      `Política de riesgo (policy.json): pesos y bloqueos`,
      `Reglas de calendario (ocd.json): ventana ${cfg.ventana.dias.join(", ")}, cupo ${cfg.ventana.maxPorNoche} por noche, feriados y congelamientos`,
      `Historial de incidentes: ${deServicio.length} de ${cambio.servicio}`,
      `Calendario de OCD: ${noches} ya programado${noches === 1 ? "" : "s"} el ${cambio.fecha}`,
    ],
    detecto: [...r.blockers.map((b) => `🛑 ${b}`), ...r.advertencias.map((a) => `⚠️ ${a}`)],
    propone: [...r.actions],
    accion: `Calculé el riesgo con el motor: ${r.nivel} (${r.score}/100) y el estado ${r.estado}.`,
    evidencia: `Mismo resultado para los mismos datos: ${resumenCambio({ ...cambio, tipo, criticidad, tamano })}`,
  };
  return { r, traza, supuestos, change, hora, fechaSugerida: r.sugerida, sugeridaTxt: r.sugerida ? `${nombreDia(r.sugerida).toLowerCase()} ${fmtFechaCorta(r.sugerida)}` : "" };
}

/** Datos que sirven de arranque para la guía paso a paso del OCD. */
export function precargaOcd(cambio, fechaSugerida = null) {
  const p = {};
  for (const k of ["servicio", "tipo", "criticidad", "tamano", "rollback", "hora"]) if (cambio[k]) p[k] = cambio[k];
  if (fechaSugerida || cambio.fecha) p.fecha = fechaSugerida ?? cambio.fecha;
  return p;
}

export { proximaVentana };
