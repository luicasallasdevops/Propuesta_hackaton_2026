// Agente de pre-validación: se ejecuta en GitHub Actions al abrir/editar un Issue de pase ([Pase]) o de OCD ([OCD]).
// 1) Lee el formulario  2) Evalúa con la política, el historial y (en OCD) el calendario y el flujo  3) Escribe el informe en /tmp para publicarlo con gh. El texto del Issue se trata solo como DATO.
import { readFile, writeFile } from "node:fs/promises";
import { parseIssueForm, changeFromForm, assess, renderReport } from "./engine.mjs";
import { cargarBases, evaluarOcd } from "./ocd-eval.mjs";
import { estadoPorEtiquetas, etiquetaEstado, etiquetaModalidad, ejecutaAutomatico, renderFlujo } from "./flujo.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const bases = await cargarBases();
const esOcd = String(event.issue.title).startsWith("[OCD]");
let result, report;
const labels = [];
if (esOcd) {
  const ev = evaluarOcd({ issue: event.issue, bases, hoy: new Date().toISOString().slice(0, 10) });
  const { flujo } = bases;
  const yaTiene = (event.issue.labels ?? []).some((l) => /^estado:/.test(typeof l === "string" ? l : l.name));
  const estadoId = estadoPorEtiquetas(event.issue.labels, flujo);
  const ctx = { conjuntosVal: ev.conjuntosVal, bloqueado: ev.bloqueado };
  result = ev.result;
  report = `${ev.report}\n\n${renderFlujo({ id: estadoId, modalidad: ev.modalidad, conjuntosVal: ev.conjuntosVal, ctx, flujo, auto: ejecutaAutomatico(estadoId, ev.modalidad, ev.conjuntosVal, flujo) })}`;
  labels.push("ocd", etiquetaModalidad(ev.modalidad));
  if (!yaTiene) labels.push(etiquetaEstado("inicio"));
} else {
  const fields = parseIssueForm(event.issue.body);
  const change = changeFromForm(fields, bases.policy);
  result = assess(change, bases.incidents, bases.policy);
  report = renderReport(change, result, bases.policy);
}

labels.unshift(`riesgo:${result.nivel.toLowerCase()}`, result.estado === "Bloqueado" ? "bloqueado" : "listo-para-aprobacion");
await writeFile("/tmp/report.md", `<!-- agente-pase -->\n${report}`);
await writeFile("/tmp/labels.txt", labels.join(","));
console.log(`Evaluado${esOcd ? " (OCD)" : ""}: ${result.estado}, riesgo ${result.nivel} (${result.score})`);
