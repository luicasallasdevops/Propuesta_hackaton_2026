import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { diaDe, sumarHabiles, planOcd, proximaVentana, ventanasProximas, assessOcd, ocdFromForm, parseIssueForm, renderOcdReport } from "../scripts/engine.mjs";

const J = async (f) => JSON.parse(await readFile(f, "utf8"));
const [policy, incidents, cfg, cal] = await Promise.all(["policy", "incidents", "ocd", "ocd-calendario"].map((f) => J(`knowledge/${f}.json`)));
const allOn = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, true]));
const ok = { comunicacion: true, verificacion: true };
const base = { servicio: "app-x", tipo: "Normal", criticidad: "Baja", tamano: "Pequeño", rollback: "Sí, probado", checks: allOn };
const HOY = cfg.fechaDemo; // lunes 2026-11-16

test("calcula el día de la semana y salta feriados y fines de semana", () => {
  assert.equal(diaDe("2026-11-19"), "Jueves");
  assert.equal(diaDe("2026-02-30"), "");
  assert.equal(sumarHabiles("2026-12-07", 1, cfg), "2026-12-09"); // 8-dic es feriado simulado
  assert.equal(sumarHabiles("2026-11-16", -1, cfg), "2026-11-13");
});

test("el plan Normal se calcula hacia atrás: CAB martes/jueves, Seguridad, líder y creación", () => {
  const p = Object.fromEntries(planOcd("Normal", "2026-11-19", cfg).map((x) => [x.id, x.fecha]));
  assert.deepEqual(p, { crear: "2026-11-12", agente: "2026-11-12", lider: "2026-11-13", seguridad: "2026-11-16", cab: "2026-11-17", agenda: "2026-11-18", ejecutar: "2026-11-19", verificar: "2026-11-19", cerrar: "2026-11-20" });
  const q = planOcd("Normal", "2026-11-18", cfg);
  assert.equal(diaDe(q.find((x) => x.id === "cab").fecha), "Jueves"); // el CAB del jueves anterior
});

test("los OCD de ejemplo dan el estado esperado el día en que se crearon", () => {
  for (const x of cal.filter((c) => ["Solicitado", "Bloqueado", "Listo para aprobaciones", "Aprobado"].includes(c.estado))) {
    const f = x.form;
    const r = assessOcd({ id: x.id, change: { servicio: x.servicio, tipo: x.tipo, criticidad: f.criticidad, tamano: f.tamano, rollback: f.rollback, checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, !f.faltan.includes(k)])) }, fecha: x.fecha, hora: x.hora, ocdChecks: { comunicacion: f.comunicacion, verificacion: f.verificacion } }, incidents, policy, cfg, cal, x.creado);
    assert.equal(r.estado === "Bloqueado", x.estado === "Bloqueado", `${x.id}: ${r.blockers.join(" | ")}`);
  }
});

test("una noche con 3 OCD está llena y el agente propone otra", () => {
  const r = assessOcd({ change: base, fecha: "2026-11-18", hora: "22:00", ocdChecks: ok }, incidents, policy, cfg, cal, "2026-11-09");
  assert.equal(r.estado, "Bloqueado");
  assert.ok(r.blockers.some((b) => b.startsWith("Ventana llena")));
  assert.ok(r.sugerida && r.sugerida !== "2026-11-18");
  assert.ok(r.actions[0].includes(r.sugerida));
  assert.equal(ventanasProximas("2026-11-16", cfg, cal).find((v) => v.fecha === "2026-11-18").estado, "llena");
});

test("viernes, feriado, congelamiento, anticipación y hora fuera de ventana bloquean", () => {
  const run = (fecha, hora = "22:00", hoy = "2026-11-02") => assessOcd({ change: base, fecha, hora, ocdChecks: ok }, incidents, policy, cfg, [], hoy);
  assert.ok(run("2026-11-20").blockers.some((b) => b.startsWith("Fuera de la ventana")));
  assert.ok(run("2026-11-26").blockers.some((b) => b.startsWith("Congelamiento")));
  assert.ok(run("2026-12-08").blockers.some((b) => b.startsWith("La fecha es feriado")));
  assert.ok(run("2026-11-19", "10:00").blockers.some((b) => b.startsWith("Hora fuera")));
  assert.ok(run("2026-11-19", "22:00", "2026-11-17").blockers.some((b) => b.startsWith("Anticipación insuficiente")));
  assert.ok(run("19/11/2026").blockers.some((b) => b.startsWith("Fecha de ejecución inválida")));
  assert.equal(run("2026-11-19").estado, "Listo para aprobaciones");
});

test("la emergencia no se bloquea por calendario; en congelamiento pide Delegado CIO", () => {
  const r = assessOcd({ change: { ...base, tipo: "Emergencia" }, fecha: "2026-11-27", hora: "03:00", ocdChecks: ok }, incidents, policy, cfg, cal, "2026-11-27");
  assert.equal(r.estado, "Listo para aprobaciones");
  assert.ok(r.aprobadores.includes("Delegado CIO"));
  assert.ok(r.advertencias.some((a) => a.includes("congelamiento")));
  assert.deepEqual(r.plan.map((p) => p.id), ["crear", "agente", "lider", "ejecutar", "verificar", "posteriori", "cerrar"]);
});

test("un Estándar de riesgo alto se trata como Normal y suma aprobadores", () => {
  const r = assessOcd({ change: { ...base, tipo: "Estándar", criticidad: "Alta", tamano: "Grande", rollback: "No", checks: { ...allOn, monitoreo: false } }, fecha: "2026-11-24", hora: "22:00", ocdChecks: ok }, incidents, policy, cfg, [], "2026-11-02");
  assert.equal(r.tipoEfectivo, "Normal");
  for (const a of ["Líder técnico", "Seguridad", "Change Management"]) assert.ok(r.aprobadores.includes(a));
});

test("lee el Issue Form del OCD y neutraliza menciones en el informe", () => {
  const body = ["Servicio", "@admin pagos-api", "Tipo de cambio", "Normal", "Criticidad del servicio", "Alta", "Tamaño del cambio", "Pequeño", "Fecha de ejecución", "2026-11-19", "Hora de inicio", "22:00", "Plan de rollback", "Sí, probado"]
    .reduce((a, v, i) => a + (i % 2 ? `${v}\n\n` : `### ${v}\n\n`), "") + "### Requisitos del OCD\n\n- [x] Ventana comunicada a las áreas impactadas\n- [ ] Plan de verificación posterior definido\n";
  const o = ocdFromForm(parseIssueForm(body), policy, cfg);
  assert.deepEqual([o.fecha, o.hora, o.change.tipo, o.ocdChecks.comunicacion, o.ocdChecks.verificacion], ["2026-11-19", "22:00", "Normal", true, false]);
  const md = renderOcdReport(o, assessOcd(o, incidents, policy, cfg, cal, "2026-11-13"), policy, cfg);
  assert.ok(!md.includes("@admin") && md.includes("Calendario del OCD") && md.includes("Aprobadores"));
});

test("proximaVentana devuelve una noche válida y con cupo", () => {
  const d = proximaVentana("Normal", HOY, cfg, cal);
  assert.ok(cfg.ventana.dias.includes(diaDe(d)));
  assert.ok(!cal.some((c) => c.fecha === d && c.id === "x"));
});
