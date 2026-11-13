// Decisiones del flujo OCD en GitHub (funciones puras, sin red): qué hacer ante un comando, un evento de git o el paso del tiempo.
// El texto de comentarios, PR y tags se trata solo como DATO: nunca se ejecuta ni se interpola en comandos.
import { esc } from "./engine.mjs";
import { evaluarOcd } from "./ocd-eval.mjs";
import {
  parseComando, estadoPorEtiquetas, etiquetaEstado, rolesDeLogin, puedeMover, cadenaAutomatica, renderFlujo, ejecutaAutomatico, rolNombre,
  estancado, eventoATransicion, ocdDeTexto, transicionesDe,
} from "./flujo.mjs";

const ASOCIACIONES = ["OWNER", "MEMBER", "COLLABORATOR"];
const nombre = (flujo, id) => flujo.estados[id].nombre;
export const todasLasEtiquetasDeEstado = (flujo) => Object.keys(flujo.estados).map(etiquetaEstado);

/** Mueve el OCD si el actor tiene el rol y se cumplen los requisitos; encadena los estados automáticos de la modalidad. */
export function ejecutarMovimiento({ cur, hacia, roles, esAgente = false, simularFalla = false, ev, flujo, quien }) {
  const ctx = { conjuntosVal: ev.conjuntosVal, bloqueado: ev.bloqueado };
  const v = puedeMover({ desde: cur, hacia, roles, esAgente, ctx, flujo, modalidad: ev.modalidad });
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const lineas = [`✅ **${esc(quien)}** movió el OCD: ${nombre(flujo, cur)} → ${nombre(flujo, hacia)}.`];
  let final = hacia;
  if (simularFalla && !ejecutaAutomatico(hacia, ev.modalidad, ev.conjuntosVal, flujo)) lineas.push("ℹ️ `falla` solo aplica a estados que se ejecutan automáticamente: se ignora.");
  for (const c of cadenaAutomatica(hacia, ev.modalidad, ev.conjuntosVal, flujo, { falla: simularFalla })) {
    lineas.push(`⚙️ Automático (${ev.modalidad}): ${nombre(flujo, c.de)} → ${nombre(flujo, c.a)}${c.tipo === "falla" ? " (falló: se revierte)" : ""}.`);
    final = c.a;
  }
  return { ok: true, final, lineas };
}

function armar({ mov, ev, flujo, issueLabels }) {
  const ctx = { conjuntosVal: ev.conjuntosVal, bloqueado: ev.bloqueado };
  const e = flujo.estados[mov.final];
  const cuerpo = [...mov.lineas, "", renderFlujo({ id: mov.final, modalidad: ev.modalidad, conjuntosVal: ev.conjuntosVal, ctx, flujo, auto: ejecutaAutomatico(mov.final, ev.modalidad, ev.conjuntosVal, flujo) })];
  if (e.final) cuerpo.push("", "🎉 **Pase cerrado.** Adjunta la evidencia de la ejecución en este Issue.");
  return { responder: true, comentario: cuerpo.join("\n"), nuevoEstado: mov.final, quitar: todasLasEtiquetasDeEstado(flujo).filter((l) => (issueLabels ?? []).some((x) => (x.name ?? x) === l)), cerrar: Boolean(e.final) };
}

const NADA = { responder: false };

/** Comentario /ocd en un Issue [OCD]. */
export function decidirComando({ cuerpo, login, asociacion, issue, bases, hoy }) {
  const { flujo, roles: rolesCfg } = bases;
  if (!String(issue.title).startsWith("[OCD]") || !ASOCIACIONES.includes(asociacion)) return NADA;
  const cmd = parseComando(cuerpo, flujo);
  if (!cmd) return NADA;
  const ev = evaluarOcd({ issue, bases, hoy });
  const cur = estadoPorEtiquetas(issue.labels, flujo);
  const roles = rolesDeLogin(login, rolesCfg);
  const ctx = { conjuntosVal: ev.conjuntosVal, bloqueado: ev.bloqueado };
  const estado = () => renderFlujo({ id: cur, modalidad: ev.modalidad, conjuntosVal: ev.conjuntosVal, ctx, flujo, auto: ejecutaAutomatico(cur, ev.modalidad, ev.conjuntosVal, flujo) });
  const solo = (texto) => ({ responder: true, comentario: texto, nuevoEstado: null, quitar: [], cerrar: false });
  if (cmd.cmd === "estado") return solo(estado());
  if (cmd.cmd === "desconocido") return solo(`No conozco el comando \`/ocd ${esc(cmd.arg ?? "")}\`. Usa \`/ocd estado\`, \`/ocd mover <estado>\`, \`/ocd falla\` o \`/ocd devolver\`.\n\n${estado()}`);
  if (!roles.length) return solo(`⛔ **${esc(login)}** no tiene un rol en el flujo OCD. Pide que lo agreguen en \`knowledge/ocd-roles.json\` (en producción vendría de Jira o del IAM).`);
  let hacia = null, simularFalla = false;
  if (cmd.cmd === "mover") {
    if (!cmd.destino) return solo(`⛔ No reconozco el estado «${esc(cmd.arg)}». Estados: ${Object.values(flujo.estados).map((e) => e.nombre).join(", ")}.\n\n${estado()}`);
    hacia = cmd.destino; simularFalla = cmd.falla;
  } else {
    const t = transicionesDe(flujo, cur).find((x) => x.tipo === (cmd.cmd === "falla" ? "falla" : "devolver"));
    if (!t) return solo(`⛔ Desde «${nombre(flujo, cur)}» no hay ${cmd.cmd === "falla" ? "rama de falla" : "devolución"}.\n\n${estado()}`);
    hacia = t.a;
  }
  const mov = ejecutarMovimiento({ cur, hacia, roles, simularFalla, ev, flujo, quien: login });
  if (!mov.ok) return solo(`⛔ ${mov.motivo}\n\n${estado()}`);
  return armar({ mov, ev, flujo, issueLabels: issue.labels });
}

/* ---------- DeployGO: eventos de git ---------- */

/** PR o tag de git relacionado con un OCD DeployGO. `roles` = roles del usuario de GitHub que lo provoca. */
export function decidirEvento({ evento, descripcionExtra = "", login, roles, issue, bases, hoy }) {
  const { flujo } = bases;
  if (!String(issue.title).startsWith("[OCD]")) return NADA;
  const ev = evaluarOcd({ issue, bases, hoy });
  if (!flujo.modalidades[ev.modalidad]?.gitops) return NADA; // solo DeployGO se mueve por eventos de git
  const cur = estadoPorEtiquetas(issue.labels, flujo);
  let t = null, rolUsado = roles;
  if (evento === "pr-aprobado") for (const r of roles) { t = eventoATransicion({ evento, rolRevisor: r, desde: cur, flujo }); if (t) { rolUsado = [r]; break; } }
  else t = eventoATransicion({ evento, desde: cur, flujo });
  if (!t) return NADA;
  const mov = ejecutarMovimiento({ cur, hacia: t.hacia, roles: rolUsado, ev, flujo, quien: `${login} (git: ${t.descripcion}${descripcionExtra ? ` · ${descripcionExtra}` : ""})` });
  if (!mov.ok) return { responder: true, comentario: `🔀 Evento de git «${esc(t.descripcion)}» recibido, pero no se mueve el OCD:\n\n⛔ ${mov.motivo}`, nuevoEstado: null, quitar: [], cerrar: false };
  return armar({ mov, ev, flujo, issueLabels: issue.labels });
}

/** Una historia [HU-####] origina su OCD DeployGO. Devuelve el Issue a crear o null. */
export function ocdDesdeHistoria({ titulo }, bases) {
  const m = String(titulo ?? "").match(/^\[(HU-\d{4})\]\s*(.*)$/i);
  if (!m) return null;
  const h = bases.historias.find((x) => x.id === m[1].toUpperCase());
  if (!h) return null;
  const limpio = String(m[2] || h.titulo).replace(/[\r\n#]/g, " ").slice(0, 100);
  return {
    titulo: `[OCD] ${h.servicio} · ${h.id} (DeployGO)`,
    cuerpo: `### Servicio\n\n${h.servicio}\n\n### Historia asociada\n\n${h.id}\n\n### Modalidad\n\nDeployGO\n\n### Descripción del cambio\n\nOCD creado automáticamente al crear la historia: ${limpio}\n\n_Completa matrícula, fecha, evidencias e instrucciones editando este Issue; el agente reevalúa al guardar._\n`,
    etiquetas: ["ocd", "modalidad:deploygo", "estado:inicio"],
  };
}

/* ---------- Avisos proactivos ---------- */

/** OCD abiertos que llevan demasiado tiempo en su estado. ocds: [{ numero, labels, desde (ISO) }]. */
export function decidirAvisos({ ocds, hoy, bases }) {
  const { flujo, cfg, roles: rolesCfg } = bases;
  const out = [];
  for (const o of ocds) {
    const id = estadoPorEtiquetas(o.labels, flujo);
    const e = flujo.estados[id];
    const x = estancado({ id, desde: o.desde, hoy, flujo, cfg });
    if (!x.vencido) continue;
    const quienes = Object.entries(rolesCfg.porLogin ?? {}).filter(([, rs]) => rs.includes(e.actor)).map(([l]) => `@${l}`);
    out.push({
      numero: o.numero, marca: `<!-- ocd-aviso:${id}:${hoy} -->`,
      comentario: `<!-- ocd-aviso:${id}:${hoy} -->\n⏰ **Este OCD lleva ${x.dias} días hábiles en «${e.nombre}»** (lo previsto es ${x.sla}).\n\nLe toca a **${rolNombre(e.actor, flujo)}**${quienes.length ? `: ${quienes.join(", ")}` : ""}.\n\n${e.queHacer}\n\nComenta \`/ocd estado\` para ver qué falta.`,
    });
  }
  return out;
}
