// Genera docs/data/*.json y copia el motor al portal. Sin dependencias.
import { readFile, writeFile, readdir, mkdir, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs", "data");
await mkdir(out, { recursive: true });

const docs = {};
for (const f of (await readdir(join(root, "knowledge"))).filter((f) => f.endsWith(".md")).sort())
  docs[f.replace(/\.md$/, "")] = await readFile(join(root, "knowledge", f), "utf8");

const templates = {};
for (const f of (await readdir(join(root, "templates", "workflows"))).sort())
  templates[`workflows/${f}`] = await readFile(join(root, "templates", "workflows", f), "utf8");
for (const f of ["dependabot.yml", "ticket-pase-produccion.md", "ocd-solicitud.md"])
  templates[f] = await readFile(join(root, "templates", f), "utf8");

await writeFile(join(out, "kb.json"), JSON.stringify(docs));
await writeFile(join(out, "templates.json"), JSON.stringify(templates));
await copyFile(join(root, "knowledge", "incidents.json"), join(out, "incidents.json"));
await copyFile(join(root, "knowledge", "policy.json"), join(out, "policy.json"));
await copyFile(join(root, "knowledge", "ocd.json"), join(out, "ocd.json"));
await copyFile(join(root, "knowledge", "ocd-calendario.json"), join(out, "ocd-calendario.json"));
await copyFile(join(root, "knowledge", "ocd-directorio.json"), join(out, "ocd-directorio.json"));
await copyFile(join(root, "knowledge", "ocd-historias.json"), join(out, "ocd-historias.json"));
await copyFile(join(root, "knowledge", "ocd-flujo.json"), join(out, "ocd-flujo.json"));
await copyFile(join(root, "scripts", "engine.mjs"), join(root, "docs", "engine.mjs"));
await copyFile(join(root, "scripts", "flujo.mjs"), join(root, "docs", "flujo.mjs"));
console.log(`kb: ${Object.keys(docs).length} docs, ${Object.keys(templates).length} plantillas`);
