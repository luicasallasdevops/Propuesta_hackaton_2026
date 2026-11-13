// Flujo del OCD como máquina de estados guiada por datos (knowledge/ocd-flujo.json).
// Funciones puras: el mismo módulo corre en GitHub Actions (Node) y en el portal (navegador). Sin dependencias.
import { validarInstrucciones, SECRETOS, PELIGROSO, esc, sumarHabiles, fechaValida } from "./engine.mjs";

const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/* ---------- Modalidad ---------- */

/** "100% automatizado", "híbrido", "DeployGO", "manual" -> nombre canónico ("" si no se reconoce). */
export function normalizarModalidad(texto) {
  const q = fold(texto);
  if (/deploy\s*-?\s*go/.test(q)) return "DeployGO";
  if (/hibrid/.test(q)) return "Híbrido";
  if (/automat/.test(q)) return "Automatizado";
  if (/manual/.test(q)) return "Manual";
  return "";
}

/* ---------- Instrucciones: cuatro conjuntos validados según la modalidad ---------- */

const RE_AUTO = /(workflow|pipeline|\bjob\b|script|github actions|deploygo|automatic|automatiz|\.sh\b|\.ya?ml\b)/i;

/** Pasos de un texto (numerados o con viñetas) y si cada uno es automático o manual ([AUTO], [MANUAL] o por palabras clave). */
export function analizarPasos(texto) {
  const pasos = [];
  const marcar = (t) => {
    const tag = /^\[auto\]/i.test(t) ? "auto" : /^\[manual\]/i.test(t) ? "manual" : null;
    pasos.push({ texto: t, tag, tipo: tag ?? (RE_AUTO.test(t) ? "auto" : null) });
  };
  for (const linea of String(texto ?? "").split("\n")) {
    const m = linea.match(/^\s*(?:\d{1,2}[.)]|[-*•])\s+(.+)$/);
    if (m) marcar(m[1].trim());
  }
  if (!pasos.length) for (const m of String(texto ?? "").matchAll(/(?:^|\s)\d{1,2}[.)]\s+(.+?)(?=\s\d{1,2}[.)]\s|$)/g)) marcar(m[1].trim());
  return pasos;
}

/** Valida un conjunto de instrucciones (congelamiento, despliegue, reversiones) según la modalidad. */
export function validarConjunto(id, texto, modalidad, ctx, flujo) {
  const t = String(texto ?? "").trim();
  const out = { id, etiqueta: flujo.conjuntos[id].etiqueta, vacio: !t, ok: false, bloqueos: [], avisos: [], pasos: 0, auto: 0, manual: 0, sinTipo: 0, todoAuto: false };
  if (!t) return out;
  if (id === "despliegue") {
    const v = validarInstrucciones(t, ctx);
    out.bloqueos.push(...v.bloqueos); out.avisos.push(...v.avisos);
  } else {
    if (t.length < 30) out.bloqueos.push("Es muy corto: describe los pasos (mínimo 30 caracteres)");
    if (t.length > 4000) out.bloqueos.push("Supera los 4000 caracteres: resume y enlaza el runbook");
    if (SECRETOS.some((re) => re.test(t))) out.bloqueos.push("Hay una credencial o secreto escrito: quítalo y usa el gestor de secretos");
    for (const [re, nombre] of PELIGROSO) if (re.test(t)) out.bloqueos.push(`Comando peligroso (${nombre}): reemplázalo por un paso seguro y reversible`);
    if (id === "congelamiento" && !/certific|\bcert\b|preprod|\bqa\b/i.test(t)) out.avisos.push("No indica el ambiente de certificación");
  }
  const pasos = analizarPasos(t);
  out.pasos = pasos.length;
  if (pasos.length < 2 && id !== "despliegue") out.bloqueos.push("Escribe al menos 2 pasos numerados (1. 2.)");
  out.auto = pasos.filter((p) => p.tipo === "auto").length;
  out.manual = pasos.filter((p) => p.tipo === "manual").length;
  out.sinTipo = pasos.filter((p) => p.tipo === null).length;
  out.todoAuto = pasos.length > 0 && out.auto === pasos.length;
  const modo = flujo.modalidades[modalidad];
  if (modo && pasos.length) {
    if (modo.automatiza === true) {
      if (out.manual) out.bloqueos.push(`${out.manual} paso(s) [MANUAL] no caben en la modalidad ${modalidad}: automatízalos o cambia a Híbrido`);
      if (out.sinTipo) out.bloqueos.push(`${out.sinTipo} paso(s) no indican automatización: etiquétalos [AUTO] o menciona el workflow, pipeline o script`);
    } else if (modo.automatiza === "segun-pasos") {
      if (out.sinTipo) out.bloqueos.push(`${out.sinTipo} paso(s) sin etiqueta: marca cada paso [AUTO] o [MANUAL]`);
      else if (out.auto === 0 || out.manual === 0) out.avisos.push(`Todos los pasos son ${out.auto ? "[AUTO]" : "[MANUAL]"}: considera la modalidad ${out.auto ? "Automatizado" : "Manual"}`);
    } else if (pasos.some((p) => p.tag === "auto")) out.avisos.push("Hay pasos [AUTO] en la modalidad Manual: considera Híbrido");
  }
  out.ok = out.bloqueos.length === 0;
  return out;
}

/** Valida los cuatro conjuntos. `conjuntos` = { congelamiento, despliegue, reversionCongelamiento, reversionDespliegue } (texto). */
export function validarConjuntos(conjuntos, modalidad, ctx, flujo) {
  const lista = Object.keys(flujo.conjuntos).map((id) => validarConjunto(id, conjuntos?.[id], modalidad, ctx, flujo));
  const faltan = lista.filter((x) => x.vacio).map((x) => x.etiqueta);
  return {
    lista, faltan, completo: faltan.length === 0,
    bloqueos: lista.flatMap((x) => x.bloqueos.map((b) => `${x.etiqueta}: ${b}`)),
    avisos: lista.flatMap((x) => x.avisos.map((a) => `${x.etiqueta}: ${a}`)),
    ok: faltan.length === 0 && lista.every((x) => x.ok),
  };
}

/** Plantilla de ayuda para cada conjunto, según la modalidad. */
export function plantillaConjunto(id, modalidad, { servicio = "<servicio>", historia = "HU-0000" } = {}) {
  const t = (auto) => (p) => (modalidad === "Híbrido" ? `[${auto ? "AUTO" : "MANUAL"}] ${p}` : modalidad === "Manual" ? p : `[AUTO] ${p}`);
  const A = t(true), M = t(false);
  const P = {
    congelamiento: [`1. ${A(`Desplegar en certificación la versión de la historia ${historia} con el workflow ocd-certificacion.`)}`, `2. ${A(`Ejecutar las pruebas de humo de ${servicio} en certificación.`)}`, `3. ${M(`Confirmar con QE que certificación quedó congelada para ${servicio}.`)}`],
    despliegue: [`1. ${M("Confirmar con el líder técnico que la ventana sigue vigente y avisar al canal de operaciones.")}`, `2. ${A(`Verificar el respaldo o snapshot más reciente de ${servicio} con el workflow ocd-respaldo.`)}`, `3. ${A(`Desplegar en producción la versión de ${historia} con el workflow ocd-ejecucion, ambiente production.`)}`, `4. ${A(`Ejecutar las pruebas de humo del runbook de ${servicio}.`)}`, `5. ${M(`Verificación posterior: vigilar métricas y alertas de ${servicio} durante 30 minutos.`)}`, `6. ${A(`Rollback: si falla la verificación, volver a la versión anterior con el mismo workflow y avisar al líder técnico.`)}`],
    reversionCongelamiento: [`1. ${A(`Revertir en certificación la versión de ${historia} con el workflow ocd-certificacion (versión anterior).`)}`, `2. ${M(`Confirmar con QE que certificación volvió al estado anterior.`)}`],
    reversionDespliegue: [`1. ${A(`Volver a la versión anterior de ${servicio} en producción con el workflow ocd-ejecucion.`)}`, `2. ${A(`Ejecutar las pruebas de humo de ${servicio}.`)}`, `3. ${M(`Vigilar métricas y alertas de ${servicio} durante 30 minutos y avisar al líder técnico.`)}`],
  };
  const lineas = P[id] ?? [];
  if (modalidad === "Automatizado" || modalidad === "DeployGO") return lineas.map((l) => l.replace(/\[MANUAL\] /, "[AUTO] ")).join("\n");
  if (modalidad === "Manual") return lineas.map((l) => l.replace(/\[(AUTO|MANUAL)\] /, "")).join("\n");
  return lineas.join("\n");
}

/* ---------- Estados y transiciones ---------- */

export const etiquetaEstado = (id) => `estado:${id}`;
export const etiquetaModalidad = (modalidad) => `modalidad:${normalizarModalidad(modalidad).toLowerCase().replace("í", "i")}`;
const nombresDe = (labels) => (labels ?? []).map((l) => (typeof l === "string" ? l : l?.name)).filter(Boolean);

/** Estado actual de un Issue a partir de sus etiquetas (por defecto, Inicio codificación). */
export function estadoPorEtiquetas(labels, flujo) {
  for (const n of nombresDe(labels)) { const m = n.match(/^estado:([a-z_]+)$/); if (m && flujo.estados[m[1]]) return m[1]; }
  return "inicio";
}

export function modalidadPorEtiquetas(labels, flujo) {
  for (const n of nombresDe(labels)) {
    const m = n.match(/^modalidad:([a-z]+)$/);
    const x = m && Object.keys(flujo.modalidades).find((k) => flujo.modalidades[k].id === m[1]);
    if (x) return x;
  }
  return "";
}

export function transicionesDe(flujo, id) {
  const e = flujo.estados[id];
  if (!e) return [];
  return [...(e.siguiente ?? []).map((a) => ({ a, tipo: "avance" })), ...(e.falla ? [{ a: e.falla, tipo: "falla" }] : []), ...(e.devolver ? [{ a: e.devolver, tipo: "devolver" }] : [])];
}

/** Estado por id, nombre o parte del nombre ("revisiones técnicas", "revisiones", "rev_pase"). */
export function resolverEstado(texto, flujo) {
  const q = fold(texto).trim().replace(/[_-]+/g, " ");
  if (!q) return null;
  const todos = Object.entries(flujo.estados);
  const exacto = todos.find(([id, e]) => id.replace(/_/g, " ") === q || fold(e.nombre) === q);
  if (exacto) return exacto[0];
  const parcial = todos.filter(([id, e]) => fold(e.nombre).startsWith(q) || id.replace(/_/g, " ").startsWith(q));
  return parcial.length === 1 ? parcial[0][0] : null;
}

/** El estado lo ejecuta una automatización (no una persona) según la modalidad y los pasos. */
export function ejecutaAutomatico(id, modalidad, conjuntosVal, flujo) {
  const e = flujo.estados[id], m = flujo.modalidades[modalidad];
  if (!e || !m || !e.conjunto) return false;
  if (m.automatiza === true) return true;
  if (m.automatiza === "segun-pasos") return conjuntosVal?.lista?.find((x) => x.id === e.conjunto)?.todoAuto === true;
  return false;
}

/** Si un estado automático "corre solo" en la simulación (DeployGO espera eventos de git y no avanza solo). */
export const avanzaSolo = (modalidad, flujo) => Boolean(flujo.modalidades[modalidad]) && !flujo.modalidades[modalidad].gitops;

/** Estados que se ejecutan solos desde `desde`; `falla` simula que la ejecución automática falla. */
export function cadenaAutomatica(desde, modalidad, conjuntosVal, flujo, { falla = false } = {}) {
  const pasos = [];
  let cur = desde, fallo = falla;
  for (let i = 0; i < 12 && avanzaSolo(modalidad, flujo) && ejecutaAutomatico(cur, modalidad, conjuntosVal, flujo); i++) {
    const e = flujo.estados[cur];
    const a = fallo && e.falla ? e.falla : e.siguiente?.[0];
    if (!a) break;
    pasos.push({ de: cur, a, tipo: fallo && e.falla ? "falla" : "avance" });
    if (fallo && e.falla) fallo = false;
    cur = a;
  }
  return pasos;
}

const ROTULO = { instruccionesCompletas: "Los cuatro conjuntos de instrucciones están completos y válidos", sinBloqueos: "El agente no encuentra bloqueos en el OCD" };

/** Requisitos que el agente puede comprobar para salir de un estado. ctx = { conjuntosVal, bloqueado }. */
export function salidaDe(id, ctx, flujo) {
  const ok = { instruccionesCompletas: ctx.conjuntosVal?.ok === true, sinBloqueos: ctx.bloqueado === false };
  return (flujo.estados[id]?.salida ?? []).map((k) => ({ id: k, texto: ROTULO[k] ?? k, ok: ok[k] === true }));
}

export const rolNombre = (rol, flujo) => flujo.roles[rol]?.nombre ?? rol;

/** ¿Puede este usuario pasar el OCD de `desde` a `hacia`? `esAgente` = automatización del propio agente. */
export function puedeMover({ desde, hacia, roles = [], esAgente = false, ctx = {}, flujo, modalidad = "" }) {
  const e = flujo.estados[desde];
  if (!e) return { ok: false, motivo: "No reconozco el estado actual del OCD." };
  if (!flujo.estados[hacia]) return { ok: false, motivo: "No reconozco el estado de destino." };
  const t = transicionesDe(flujo, desde).find((x) => x.a === hacia);
  if (!t) {
    const opts = transicionesDe(flujo, desde).map((x) => flujo.estados[x.a].nombre);
    return { ok: false, motivo: `No se puede pasar de «${e.nombre}» a «${flujo.estados[hacia].nombre}».${opts.length ? ` Desde «${e.nombre}» puedes ir a: ${opts.join(", ")}.` : " Este estado es final."}` };
  }
  const delAgente = esAgente && ejecutaAutomatico(desde, modalidad, ctx.conjuntosVal, flujo);
  if (!roles.includes(e.actor) && !delAgente) return { ok: false, motivo: `Solo ${rolNombre(e.actor, flujo)} puede mover un OCD que está en «${e.nombre}».` };
  if (t.tipo === "avance") {
    const falta = salidaDe(desde, ctx, flujo).filter((c) => !c.ok);
    if (falta.length) return { ok: false, motivo: `Aún no se puede avanzar desde «${e.nombre}»: ${falta.map((f) => f.texto).join("; ")}.`, falta };
  }
  return { ok: true, tipo: t.tipo };
}

/* ---------- Comandos de comentario (/ocd ...) ---------- */

/** Lee un comando de la primera línea de un comentario. Devuelve null si no empieza con /ocd. */
export function parseComando(texto, flujo) {
  const l = String(texto ?? "").split("\n")[0].trim().slice(0, 120);
  const m = l.match(/^\/ocd(?=\s|$)(?:\s+(\S+))?\s*(.*)$/i);
  if (!m) return null;
  const cmd = fold(m[1] ?? "estado");
  let arg = m[2].trim();
  if (cmd === "estado" || cmd === "ayuda") return { cmd: "estado" };
  if (cmd === "falla") return { cmd: "falla" };
  if (cmd === "devolver") return { cmd: "devolver" };
  if (cmd === "mover") {
    const falla = /\bfalla\b/i.test(arg);
    if (falla) arg = arg.replace(/\bfalla\b/i, "").trim();
    const destino = resolverEstado(arg, flujo);
    return { cmd: "mover", destino, arg, falla };
  }
  return { cmd: "desconocido", arg: m[1] };
}

/* ---------- Informe del estado del flujo (Markdown, para el Issue y el chat) ---------- */

const ICONO_SET = (x) => (x.vacio ? "⬜ falta" : x.ok ? "✅ válidas" : "🛑 con bloqueos");

export function renderFlujo({ id, modalidad, conjuntosVal, ctx, flujo, auto = false }) {
  const e = flujo.estados[id], total = Object.keys(flujo.estados).length;
  const L = [];
  L.push("### 🧭 Flujo del OCD");
  L.push(`**Estado:** ${e.nombre} (${e.orden} de ${total}) · **Modalidad:** ${modalidad || "sin indicar"} · **Lo mueve:** ${rolNombre(e.actor, flujo)}${auto ? " (automático en esta modalidad)" : ""}`, "");
  L.push(`**Qué hacer:** ${e.queHacer}`, "");
  const sal = salidaDe(id, ctx, flujo);
  if (sal.length) L.push("**Para avanzar:**", ...sal.map((c) => `- ${c.ok ? "✅" : "⬜"} ${c.texto}`), "");
  if (conjuntosVal) {
    L.push("**Instrucciones:**", "| Conjunto | Estado | Pasos | Auto / Manual |", "|---|---|---|---|",
      ...conjuntosVal.lista.map((x) => `| ${x.etiqueta} | ${ICONO_SET(x)} | ${x.pasos} | ${x.auto} / ${x.manual} |`), "");
  }
  const sig = transicionesDe(flujo, id);
  if (sig.length) L.push("**Cómo moverlo** (comenta en este Issue; solo el rol indicado puede hacerlo):", ...sig.map((t) => `- \`/ocd mover ${t.a}\` → ${flujo.estados[t.a].nombre}${t.tipo === "falla" ? " (si falla)" : t.tipo === "devolver" ? " (devolver)" : ""}`), "");
  L.push("**Recorrido:** " + Object.entries(flujo.estados).sort((a, b) => a[1].orden - b[1].orden).map(([k, x]) => (k === id ? `**${esc(x.nombre)}**` : x.rama ? `_${esc(x.nombre)}_` : esc(x.nombre))).join(" → "));
  L.push("", "_Los estados en cursiva son ramas: solo se usan si algo falla._");
  return L.join("\n");
}

/* ---------- Estancamiento (avisos proactivos) ---------- */

/** Días hábiles entre dos fechas AAAA-MM-DD (0 si no son válidas o si `hasta` no es posterior). */
export function diasHabilesEntre(desde, hasta, cfg) {
  if (!fechaValida(desde) || !fechaValida(hasta) || hasta <= desde) return 0;
  let n = 0;
  while (n < 90 && sumarHabiles(desde, n + 1, cfg) <= hasta) n++;
  return n;
}

/** ¿Lleva el OCD más días hábiles de los previstos (SLA) en su estado? */
export function estancado({ id, desde, hoy, flujo, cfg }) {
  const e = flujo.estados[id];
  if (!e || e.final) return { vencido: false, dias: 0, sla: e?.sla ?? 0 };
  const dias = diasHabilesEntre(String(desde).slice(0, 10), hoy, cfg);
  return { vencido: dias > e.sla, dias, sla: e.sla };
}

/* ---------- DeployGO: eventos de git -> transiciones ---------- */

/** Número de OCD mencionado en un texto: "OCD #12" o "ocd-12-cert". */
export function ocdDeTexto(texto) {
  const m = String(texto ?? "").match(/\bocd[\s#-]*#?(\d{1,6})\b/i);
  return m ? Number(m[1]) : null;
}

/** Evento de git -> estado destino (solo si el estado actual lo permite). evento: "pr-abierto" | "pr-aprobado" | "tag:cert|prod|ratificado|revertir". */
export function eventoATransicion({ evento, rolRevisor = "", desde, flujo }) {
  const clave = evento === "pr-aprobado" ? `pr-aprobado:${rolRevisor}` : evento;
  const x = flujo.eventosGit.find((g) => g.evento === clave && (!g.desde || g.desde === desde));
  return x ? { hacia: x.hacia, descripcion: x.descripcion } : null;
}

/** Rol(es) de un usuario de GitHub según knowledge/ocd-roles.json (sin distinguir mayúsculas). */
export function rolesDeLogin(login, rolesCfg) {
  const k = Object.keys(rolesCfg.porLogin ?? {}).find((x) => x.toLowerCase() === String(login ?? "").toLowerCase());
  return k ? [...rolesCfg.porLogin[k]] : [];
}

/** Rol por texto libre del chat: "soy líder técnico" -> "lider-tecnico". */
export function rolDeTexto(texto, flujo) {
  const q = fold(texto);
  let mejor = null;
  for (const [id, r] of Object.entries(flujo.roles)) for (const a of r.alias) if (new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(q) && (!mejor || a.length > mejor.len)) mejor = { id, len: a.length };
  return mejor?.id ?? null;
}

/** Qué le toca a un rol: estados donde él mueve el OCD. */
export function pendientesDeRol(rol, flujo) {
  return Object.entries(flujo.estados).filter(([, e]) => e.actor === rol).sort((a, b) => a[1].orden - b[1].orden).map(([id, e]) => ({ id, ...e }));
}
