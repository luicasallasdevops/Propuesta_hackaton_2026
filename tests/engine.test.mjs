import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { splitSections, search, parseIssueForm, changeFromForm, assess, renderReport } from "../scripts/engine.mjs";

const policy = JSON.parse(await readFile("knowledge/policy.json", "utf8"));
const incidents = JSON.parse(await readFile("knowledge/incidents.json", "utf8"));
const today = new Date("2026-11-12");
const allOn = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, true]));

test("busca el flujo de pase a producción", async () => {
  const docs = { "01": await readFile("knowledge/01-pase-a-produccion.md", "utf8"), "02": await readFile("knowledge/02-roles-y-accesos.md", "utf8") };
  const [top] = search(splitSections(docs), "como pido un rol de github", 1);
  assert.equal(top.doc, "02");
});

test("cambio sano de bajo riesgo queda listo", () => {
  const r = assess({ servicio: "app-x", criticidad: "Baja", tamano: "Pequeño", dia: "Martes", rollback: "Sí, probado", checks: allOn }, incidents, policy, today);
  assert.equal(r.nivel, "Bajo");
  assert.equal(r.estado, "Listo para aprobaciones");
});

test("sin SAST o secretos el pase se bloquea", () => {
  const r = assess({ servicio: "app-x", criticidad: "Baja", tamano: "Pequeño", dia: "Martes", rollback: "Sí, probado", checks: { ...allOn, sast: false, secretos: false } }, incidents, policy, today);
  assert.equal(r.estado, "Bloqueado");
  assert.equal(r.blockers.length, 2);
});

test("viernes + sin rollback + historial en pagos-api eleva el riesgo", () => {
  const r = assess({ servicio: "pagos-api", criticidad: "Alta", tamano: "Grande", dia: "Viernes", rollback: "No", checks: { ...allOn, monitoreo: false } }, incidents, policy, today);
  assert.ok(["Alto", "Crítico"].includes(r.nivel));
  assert.ok(r.similar.length >= 2);
  assert.ok(r.actions.some((a) => a.includes("rollback")));
  assert.ok(r.actions.some((a) => a.includes("martes-jueves")));
});

test("parsea el Issue Form y neutraliza menciones en el informe", () => {
  const body = "### Servicio\n\n@admin <b>pagos-api</b>\n\n### Criticidad del servicio\n\nAlta\n\n### Evidencias y controles\n\n- [x] Pruebas QA aprobadas\n- [ ] Escaneo de secretos limpio\n";
  const change = changeFromForm(parseIssueForm(body), policy);
  assert.equal(change.checks.qa, true);
  assert.equal(change.checks.secretos, false);
  const md = renderReport(change, assess(change, incidents, policy, today), policy);
  assert.ok(!md.includes("@admin") && !md.includes("<b>"));
});

test("el Issue Form real se interpreta completo", async () => {
  const body = ["Servicio","pagos-api","Tipo de cambio","Normal","Criticidad del servicio","Alta","Tamaño del cambio","Grande","Día de despliegue","Viernes","Plan de rollback","No"]
    .reduce((a, v, i) => a + (i % 2 ? `${v}\n\n` : `### ${v}\n\n`), "") +
    "### Evidencias y controles\n\n- [x] Pruebas QA aprobadas\n- [x] Escaneo de secretos limpio\n- [ ] SAST sin hallazgos críticos o altos\n";
  const c = changeFromForm(parseIssueForm(body), policy);
  assert.deepEqual([c.servicio, c.criticidad, c.tamano, c.dia, c.rollback], ["pagos-api", "Alta", "Grande", "Viernes", "No"]);
  assert.equal(c.checks.sast, false);
});
