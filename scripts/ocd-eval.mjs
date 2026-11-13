// Evaluación completa de un Issue [OCD]: riesgo, calendario, solicitante, historia, modalidad y cuatro conjuntos de instrucciones.
// Lo usan el agente (al abrir o editar el Issue) y el flujo (al mover de estado), para que ambos vean lo mismo.
import { readFile } from "node:fs/promises";
import { parseIssueForm, ocdFromForm, assessOcd, renderOcdReport, revisarSolicitanteOcd, combinarSolicitante, revisarHistoriaEInstrucciones } from "./engine.mjs";
import { normalizarModalidad, validarConjuntos, modalidadPorEtiquetas } from "./flujo.mjs";

const read = async (f) => JSON.parse(await readFile(f, "utf8"));
const limpio = (v) => (v && v !== "_No response_" ? v.trim().slice(0, 4100) : "");

/** Carga las bases de conocimiento (JSON) una sola vez. */
export async function cargarBases() {
  const [policy, incidents, cfg, calendario, dir, historias, flujo, roles] = await Promise.all(
    ["policy", "incidents", "ocd", "ocd-calendario", "ocd-directorio", "ocd-historias", "ocd-flujo", "ocd-roles"].map((n) => read(`knowledge/${n}.json`)));
  return { policy, incidents, cfg, calendario, dir, historias, flujo, roles };
}

/** Lee la modalidad y los cuatro conjuntos de instrucciones del formulario. */
export function conjuntosDeForm(fields, flujo) {
  const c = {};
  for (const [id, def] of Object.entries(flujo.conjuntos)) c[id] = limpio(fields[def.etiqueta]);
  return c;
}

export function evaluarOcd({ issue, bases, hoy }) {
  const { policy, incidents, cfg, calendario, dir, historias, flujo } = bases;
  const fields = parseIssueForm(issue.body);
  const ocd = ocdFromForm(fields, policy, cfg);
  const advertenciasModalidad = [];
  let modalidad = normalizarModalidad(fields["Modalidad"]) || modalidadPorEtiquetas(issue.labels, flujo);
  if (!modalidad) { modalidad = "Manual"; advertenciasModalidad.push("No indicaste la modalidad (Automatizado, Manual, Híbrido o DeployGO): se asume Manual."); }
  const conjuntos = conjuntosDeForm(fields, flujo);
  const conjuntosVal = validarConjuntos(conjuntos, modalidad, { servicio: ocd.change.servicio, criticidad: ocd.change.criticidad }, flujo);

  const sol = revisarSolicitanteOcd({ servicio: ocd.change.servicio, matricula: ocd.matricula, perfil: ocd.perfil }, dir);
  const revH = revisarHistoriaEInstrucciones({ historia: ocd.historia, instrucciones: "", servicio: ocd.change.servicio, criticidad: ocd.change.criticidad }, historias);
  const despliegue = conjuntosVal.lista.find((x) => x.id === "despliegue");
  const rev = {
    bloqueos: [...revH.bloqueos, ...conjuntosVal.bloqueos.map((b) => `Instrucciones: ${b}`)],
    advertencias: [...advertenciasModalidad, ...revH.advertencias.filter((a) => !/instrucciones de despliegue/i.test(a)), ...(conjuntosVal.faltan.length ? [`Faltan instrucciones: ${conjuntosVal.faltan.join(", ")}. Se necesitan los cuatro conjuntos para pasar a Revisiones técnicas.`] : []), ...conjuntosVal.avisos.map((a) => `Instrucciones: ${a}`)],
    acciones: revH.acciones, historia: revH.historia,
    instr: despliegue && !despliegue.vacio ? { ok: despliegue.ok, pasos: despliegue.pasos } : null,
  };
  const result = combinarSolicitante(assessOcd({ ...ocd, id: `#${issue.number}` }, incidents, policy, cfg, calendario, hoy), sol, rev);
  const report = renderOcdReport(ocd, result, policy, cfg, sol, rev);
  return { ocd, result, report, sol, rev, modalidad, conjuntosVal, bloqueado: result.estado === "Bloqueado" };
}
