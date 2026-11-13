import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { estadoJira, etiquetasJira, clienteJira, sincronizarOcd } from "../scripts/jira.mjs";

const mapa = JSON.parse(await readFile(new URL("../knowledge/ocd-jira.json", import.meta.url), "utf8"));
const flujo = JSON.parse(await readFile(new URL("../knowledge/ocd-flujo.json", import.meta.url), "utf8"));

test("todos los estados del flujo OCD tienen un estado de Jira", () => {
  for (const id of Object.keys(flujo.estados)) assert.ok(estadoJira(mapa, id), `falta ${id}`);
  assert.equal(estadoJira(mapa, "inicio"), "Tareas por hacer");
  assert.equal(estadoJira(mapa, "done"), "Finalizada");
  assert.equal(estadoJira(mapa, "xx"), null);
});

test("las etiquetas no llevan espacios y guardan el estado exacto", () => {
  const e = etiquetasJira(mapa, 12, "gestion_pase");
  assert.ok(e.includes("gh-ocd-12") && e.includes("ocd-estado-gestion_pase") && e.every((x) => !/\s/.test(x)));
});

test("rechaza una URL de Jira que no sea Atlassian Cloud", () => {
  assert.throws(() => clienteJira({ baseUrl: "https://evil.example.com", email: "a", token: "b" }));
  assert.throws(() => clienteJira({ baseUrl: "http://x.atlassian.net", email: "a", token: "b" }));
});

/** Jira simulado: guarda las llamadas y responde según la ruta. */
function falso({ existente = null } = {}) {
  const llamadas = [];
  const jira = { pedir: async (m, r, c) => {
    llamadas.push([m, r.split("?")[0], c]);
    if (r.startsWith("/rest/api/3/search/jql")) return { issues: existente ? [existente] : [] };
    if (m === "POST" && r === "/rest/api/3/issue") return { key: "KAN-9" };
    if (r.endsWith("/transitions") && m === "GET") return { transitions: [{ id: "21", to: { name: "En curso" } }, { id: "31", to: { name: "Finalizada" } }, { id: "41", to: { name: "En revisión" } }] };
    return null;
  } };
  return { jira, llamadas };
}

test("crea la incidencia si no existe y la mueve al estado del OCD", async () => {
  const { jira, llamadas } = falso();
  const r = await sincronizarOcd({ jira, mapa, numero: 12, titulo: "[OCD] pagos-api", url: "https://github.com/o/r/issues/12", estado: "ejecucion" });
  assert.match(r, /KAN-9 creada; movida a "En curso"/);
  const crear = llamadas.find((l) => l[0] === "POST" && l[1] === "/rest/api/3/issue");
  assert.equal(crear[2].fields.project.key, "KAN");
  assert.equal(crear[2].fields.issuetype.name, "Tarea");
  assert.ok(crear[2].fields.labels.includes("gh-ocd-12"));
});

test("es idempotente: si ya existe y ya está en el estado, no hace nada más", async () => {
  const { jira, llamadas } = falso({ existente: { key: "KAN-6", fields: { status: { name: "En curso" }, labels: ["ocd", "gh-ocd-12", "ocd-estado-ejecucion"] } } });
  const r = await sincronizarOcd({ jira, mapa, numero: 12, titulo: "t", url: "u", estado: "ejecucion" });
  assert.match(r, /ya está en "En curso"/);
  assert.equal(llamadas.some((l) => l[0] === "POST" || l[0] === "PUT"), false);
});

test("actualiza la etiqueta de estado y transiciona cuando cambia", async () => {
  const { jira, llamadas } = falso({ existente: { key: "KAN-6", fields: { status: { name: "En curso" }, labels: ["ocd", "gh-ocd-12", "ocd-estado-ejecucion"] } } });
  const r = await sincronizarOcd({ jira, mapa, numero: 12, titulo: "t", url: "u", estado: "done" });
  assert.match(r, /movida a "Finalizada"/);
  const put = llamadas.find((l) => l[0] === "PUT");
  assert.ok(put[2].fields.labels.includes("ocd-estado-done") && !put[2].fields.labels.includes("ocd-estado-ejecucion"));
});

test("falla con claridad si Jira no ofrece la transición", async () => {
  const jira = { pedir: async (m, r) => r.startsWith("/rest/api/3/search") ? { issues: [{ key: "KAN-1", fields: { status: { name: "X" }, labels: [] } }] } : r.endsWith("/transitions") && m === "GET" ? { transitions: [] } : null };
  await assert.rejects(sincronizarOcd({ jira, mapa, numero: 1, titulo: "t", url: "u", estado: "done" }), /no hay transición/);
});
