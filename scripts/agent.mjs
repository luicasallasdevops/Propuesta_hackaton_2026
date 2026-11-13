// Agente de pre-validación: se ejecuta en GitHub Actions al abrir/editar un Issue de pase.
// 1) Lee el formulario  2) Evalúa con la política y el historial  3) Escribe el informe en /tmp para publicarlo con gh. El texto del Issue se trata solo como DATO.
import { readFile, writeFile } from "node:fs/promises";
import { parseIssueForm, changeFromForm, assess, renderReport } from "./engine.mjs";

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const policy = JSON.parse(await readFile("knowledge/policy.json", "utf8"));
const incidents = JSON.parse(await readFile("knowledge/incidents.json", "utf8"));

const fields = parseIssueForm(event.issue.body);
const change = changeFromForm(fields, policy);
const result = assess(change, incidents, policy);
const report = renderReport(change, result, policy);

const labels = [`riesgo:${result.nivel.toLowerCase()}`, result.estado === "Bloqueado" ? "bloqueado" : "listo-para-aprobacion"];
await writeFile("/tmp/report.md", report);
await writeFile("/tmp/labels.txt", labels.join(","));
console.log(`Evaluado: ${result.estado}, riesgo ${result.nivel} (${result.score})`);
