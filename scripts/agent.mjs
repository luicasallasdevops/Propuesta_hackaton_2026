// Agente de pre-validación: se ejecuta en GitHub Actions al abrir/editar un Issue de pase ([Pase]) o de OCD ([OCD]).
// 1) Lee el formulario  2) Evalúa con la política, el historial y (en OCD) el calendario  3) Escribe el informe en /tmp para publicarlo con gh. El texto del Issue se trata solo como DATO.
import { readFile, writeFile } from "node:fs/promises";
import { parseIssueForm, changeFromForm, assess, renderReport, ocdFromForm, assessOcd, renderOcdReport, revisarSolicitanteOcd, combinarSolicitante } from "./engine.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const read = async (f) => JSON.parse(await readFile(f, "utf8"));
const policy = await read("knowledge/policy.json");
const incidents = await read("knowledge/incidents.json");

const fields = parseIssueForm(event.issue.body);
const esOcd = String(event.issue.title).startsWith("[OCD]");
let result, report;
if (esOcd) {
  const cfg = await read("knowledge/ocd.json");
  const calendario = await read("knowledge/ocd-calendario.json");
  const dir = await read("knowledge/ocd-directorio.json");
  const ocd = ocdFromForm(fields, policy, cfg);
  const sol = revisarSolicitanteOcd({ servicio: ocd.change.servicio, matricula: ocd.matricula }, dir);
  result = combinarSolicitante(assessOcd({ ...ocd, id: `#${event.issue.number}` }, incidents, policy, cfg, calendario, new Date().toISOString().slice(0, 10)), sol);
  report = renderOcdReport(ocd, result, policy, cfg, sol);
} else {
  const change = changeFromForm(fields, policy);
  result = assess(change, incidents, policy);
  report = renderReport(change, result, policy);
}

const labels = [`riesgo:${result.nivel.toLowerCase()}`, result.estado === "Bloqueado" ? "bloqueado" : "listo-para-aprobacion"];
if (esOcd) labels.push("ocd");
await writeFile("/tmp/report.md", report);
await writeFile("/tmp/labels.txt", labels.join(","));
console.log(`Evaluado${esOcd ? " (OCD)" : ""}: ${result.estado}, riesgo ${result.nivel} (${result.score})`);
