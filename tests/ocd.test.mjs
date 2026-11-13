import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { diaDe, sumarHabiles, planOcd, proximaVentana, ventanasProximas, assessOcd, ocdFromForm, parseIssueForm, renderOcdReport } from "../scripts/engine.mjs";

const J = async (f) => JSON.parse(await readFile(f, "utf8"));
const [policy, incidents, cfg, cal] = await Promise.all(["policy", "incidents", "ocd", "ocd-calendario"].map((f) => J(`knowledge/${f}.json`)));
const allOn = Object.fromEntries(Object.keys(policy.controles).map((k) => [k, true]));
const ok = { comunicacion: true, verificacion: true };
const base = { servicio: "app-x", tipo: "Normal", criticidad: "Baja", rollback: "Sí, probado", checks: allOn };
const HOY = cfg.fechaDemo; // lunes 2026-11-16

test("calcula el día de la semana y salta feriados y fines de semana", () => {
  assert.equal(diaDe("2026-11-19"), "Jueves");
  assert.equal(diaDe("2026-02-30"), "");
  assert.equal(sumarHabiles("2026-12-07", 1, cfg), "2026-12-09"); // 8-dic es feriado simulado
  assert.equal(sumarHabiles("2026-11-16", -1, cfg), "2026-11-13");
});

test("el plan Normal se calcula hacia atrás: Comité de Gestión de Cambios martes/jueves, Seguridad, líder y creación", () => {
  const p = Object.fromEntries(planOcd("Normal", "2026-11-19", cfg).map((x) => [x.id, x.fecha]));
  assert.deepEqual(p, { crear: "2026-11-12", agente: "2026-11-12", lider: "2026-11-13", seguridad: "2026-11-16", cab: "2026-11-17", agenda: "2026-11-18", ejecutar: "2026-11-19", verificar: "2026-11-19", cerrar: "2026-11-20" });
  const q = planOcd("Normal", "2026-11-18", cfg);
  assert.equal(diaDe(q.find((x) => x.id === "cab").fecha), "Jueves"); // el Comité de Gestión de Cambios del jueves anterior
});

test("los OCD de ejemplo dan el estado esperado el día en que se crearon", () => {
  for (const x of cal.filter((c) => ["Solicitado", "Bloqueado", "Listo para aprobaciones", "Aprobado"].includes(c.estado))) {
    const f = x.form;
    const r = assessOcd({ id: x.id, change: { servicio: x.servicio, tipo: x.tipo, criticidad: f.criticidad, rollback: f.rollback, checks: Object.fromEntries(Object.keys(policy.controles).map((k) => [k, !f.faltan.includes(k)])) }, fecha: x.fecha, hora: x.hora, ocdChecks: { comunicacion: f.comunicacion, verificacion: f.verificacion } }, incidents, policy, cfg, cal, x.creado);
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
  const r = assessOcd({ change: { ...base, tipo: "Estándar", criticidad: "Alta", rollback: "No", checks: { ...allOn, monitoreo: false, sca: false, sast: false } }, fecha: "2026-11-24", hora: "22:00", ocdChecks: ok }, incidents, policy, cfg, [], "2026-11-02");
  assert.equal(r.tipoEfectivo, "Normal");
  for (const a of ["Líder técnico", "Seguridad", "Change Management"]) assert.ok(r.aprobadores.includes(a));
});

test("lee el Issue Form del OCD y neutraliza menciones en el informe", () => {
  const body = ["Servicio", "@admin pagos-api", "Tipo de cambio", "Normal", "Criticidad del servicio", "Alta", "Fecha de ejecución", "2026-11-19", "Hora de inicio", "22:00", "Plan de rollback", "Sí, probado"]
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

test("valida grupos de red y aprobadores por servicio", async () => {
  const { validarEquipoOcd } = await import("../scripts/engine.mjs");
  const dir = await J("knowledge/ocd-directorio.json");
  const nueva = validarEquipoOcd({ servicio: "pagos-api", usuarioId: "nueva", tipo: "Normal", elegidos: { "Líder técnico": "P-05", "Seguridad": "P-03" } }, dir, cfg);
  assert.deepEqual(nueva.grupos.filter((g) => !g.tiene).map((g) => g.id), ["VSDP-DEVELOPER"]);
  assert.deepEqual(nueva.roles.map((r) => [r.rol, r.estado]), [["Líder técnico", "incorrecto"], ["Product Owner", "falta"], ["Seguridad", "ok"], ["Change Management", "falta"]]);
  assert.equal(nueva.completo, false);
  const experto = validarEquipoOcd({ servicio: "pagos-api", usuarioId: "experto", tipo: "Normal", elegidos: { "Líder técnico": "P-01", "Product Owner": "P-02", "Seguridad": "P-03", "Change Management": "P-04" } }, dir, cfg);
  assert.equal(experto.completo, true);
  assert.equal(validarEquipoOcd({ servicio: "x", usuarioId: "nueva" }, dir, cfg).servicioConocido, false);
});

test("todo servicio del calendario y de los roles existe en el directorio", async () => {
  const dir = await J("knowledge/ocd-directorio.json");
  for (const c of cal) assert.ok(dir.servicios[c.servicio], c.servicio);
  for (const s of Object.values(dir.servicios)) {
    Object.entries(s.roles).forEach(([rol, id]) => assert.equal(dir.personas[id].rol, rol));
  }
});

test("fechas extremas o basura no rompen el agente", () => {
  for (const fecha of ["9999-12-31", "0001-01-01", "2026-02-30", "<script>", "1999-12-31", "2100-01-01"]) {
    for (const hoy of ["2026-11-16", "9999-12-31", "no-fecha"]) {
      const r = assessOcd({ change: { ...base, tipo: "Normal" }, fecha, hora: "22:00", ocdChecks: ok }, incidents, policy, cfg, cal, hoy);
      assert.equal(r.estado, "Bloqueado", `${fecha} / ${hoy}`);
      renderOcdReport({ change: base, fecha, hora: "22:00" }, r, policy, cfg);
    }
  }
});

test("sin fecha no bloquea: la fecha se define en Gestión de pase, pero una fecha mal escrita sí", () => {
  const r = assessOcd({ change: { ...base, tipo: "Normal" }, fecha: "", hora: "", ocdChecks: ok }, incidents, policy, cfg, cal, "2026-11-16");
  assert.equal(r.blockers.some((b) => /Fecha de ejecución inválida/.test(b)), false);
  assert.ok(r.advertencias.some((a) => /Gestión de pase/.test(a)));
  const mala = assessOcd({ change: { ...base, tipo: "Normal" }, fecha: "ayer", hora: "22:00", ocdChecks: ok }, incidents, policy, cfg, cal, "2026-11-16");
  assert.ok(mala.blockers.some((b) => /Fecha de ejecución inválida/.test(b)));
});

test("la matrícula identifica al solicitante y se validan sus grupos de red", async () => {
  const { normalizarMatricula, buscarPorMatricula, revisarSolicitanteOcd, combinarSolicitante } = await import("../scripts/engine.mjs");
  const dir = await J("knowledge/ocd-directorio.json");
  assert.equal(normalizarMatricula(" m10458 "), "M-10458");
  assert.equal(normalizarMatricula("10458; drop"), "");
  assert.equal(buscarPorMatricula(dir, "m-10212").id, "experto");
  assert.equal(buscarPorMatricula(dir, "M-99999"), null);
  assert.deepEqual(new Set(Object.values(dir.usuarios).map((u) => u.matricula)).size, Object.keys(dir.usuarios).length);

  const faltan = revisarSolicitanteOcd({ servicio: "pagos-api", matricula: "M-10458" }, dir);
  assert.deepEqual(faltan.bloqueos.map((b) => b.match(/VSDP-[\w-]+/)[0]), ["VSDP-DEVELOPER"]);
  assert.ok(faltan.acciones[0].includes("Solicitud de acceso"));
  assert.equal(revisarSolicitanteOcd({ servicio: "pagos-api", matricula: "M-10212" }, dir).bloqueos.length, 0);
  assert.deepEqual(revisarSolicitanteOcd({ servicio: "pagos-api", matricula: "M-10458", perfil: "Líder técnico" }, dir).bloqueos.map((b) => b.match(/(INCT|VSDP)[\w-]+/)[0]), ["INCT_ADMIN_INCT_PROD", "VSDP-ADMIN"]);
  assert.equal(revisarSolicitanteOcd({ servicio: "pagos-api", matricula: "" }, dir).bloqueos[0], "Falta la matrícula del solicitante");
  assert.ok(revisarSolicitanteOcd({ servicio: "pagos-api", matricula: "M-99999" }, dir).bloqueos[0].includes("no existe"));
  assert.equal(revisarSolicitanteOcd({ servicio: "app-x", matricula: "M-10212" }, dir).bloqueos.length, 0);

  const o = { change: { ...base }, fecha: "2026-11-24", hora: "22:00", ocdChecks: ok };
  const r = assessOcd(o, incidents, policy, cfg, [], "2026-11-16");
  assert.equal(r.estado, "Listo para aprobaciones");
  assert.equal(combinarSolicitante(r, faltan).estado, "Bloqueado");
  const md = renderOcdReport(o, combinarSolicitante(r, faltan), policy, cfg, faltan);
  assert.ok(md.includes("Solicitante y grupos de red") && md.includes("❌ VSDP-DEVELOPER"));
});

test("escenario 1: grupos DevSecOps y solicitud en Helpdesk", async () => {
  const { revisarGruposDevsecops, crearSolicitudHelpdesk } = await import("../scripts/engine.mjs");
  const dir = await J("knowledge/ocd-directorio.json");
  const v = dir.usuarios.nueva;
  const r = revisarGruposDevsecops(v, dir);
  assert.deepEqual(r.faltan.map((g) => g.id), ["VSDP-DEVELOPER"]);
  assert.equal(r.completo, false);
  const hd = crearSolicitudHelpdesk({ usuario: v, ids: r.faltan.map((g) => g.id), dir, numero: 501 });
  assert.equal(hd.key, "HD-501");
  assert.equal(hd.estado, "Pendiente de aprobación");
  assert.equal(hd.grupos.length, 1);
  assert.equal(revisarGruposDevsecops(v, dir, ["VSDP-DEVELOPER"]).completo, true);
  assert.deepEqual(revisarGruposDevsecops(v, dir, [], "Líder técnico").faltan.map((g) => g.id), ["INCT_ADMIN_INCT_PROD", "VSDP-ADMIN"]);
  assert.equal(revisarGruposDevsecops(dir.usuarios.experto, dir).completo, true);
});

test("escenario 2: historia, instrucciones y revisión combinada", async () => {
  const { validarHistoria, armarHistoria, validarInstrucciones, plantillaInstrucciones, revisarHistoriaEInstrucciones, normalizarHistoria } = await import("../scripts/engine.mjs");
  const hs = await J("knowledge/ocd-historias.json");
  assert.equal(normalizarHistoria("hu3101"), "HU-3101");
  assert.equal(normalizarHistoria("x; drop"), "");
  assert.equal(validarHistoria({ historia: "HU-3101", servicio: "pagos-api" }, hs).ok, true);
  assert.match(validarHistoria({ historia: "HU-3101", servicio: "canal-web" }, hs).motivo, /es del servicio pagos-api/);
  assert.match(validarHistoria({ historia: "HU-9999", servicio: "pagos-api" }, hs).motivo, /no existe/);
  assert.equal(validarHistoria({ historia: "", servicio: "pagos-api" }, hs).ok, false);
  const h = armarHistoria({ rol: "analista", objetivo: "ver el motivo del rechazo", beneficio: "atender mejor al cliente", servicio: "pagos-api", numero: 3201 });
  assert.equal(h.id, "HU-3201");
  assert.match(h.descripcion, /^Como analista quiero ver el motivo/);
  assert.equal(h.criterios.length, 3);
  assert.equal(armarHistoria({ rol: "<b>x</b>@a", objetivo: "o", beneficio: "b", servicio: "s", numero: 1 }).descripcion.includes("<"), false);

  const plantilla = plantillaInstrucciones({ servicio: "pagos-api", historia: "HU-3101", fecha: "2026-11-18" });
  const ok = validarInstrucciones(plantilla, { servicio: "pagos-api", criticidad: "Alta" });
  assert.deepEqual(ok.bloqueos, []);
  assert.ok(ok.pasos >= 6);
  const mal = validarInstrucciones("1. rm -rf /tmp\n2. password=abc12345 ok\n3. listo y terminado para ir adelante con todo el proceso rapido sin mas", {});
  assert.ok(mal.bloqueos.some((b) => b.includes("rm -rf")));
  assert.ok(mal.bloqueos.some((b) => b.includes("secreto")));
  assert.ok(mal.bloqueos.some((b) => b.includes("rollback")));
  assert.equal(validarInstrucciones("corto", {}).ok, false);

  const rev = revisarHistoriaEInstrucciones({ historia: "HU-3101", instrucciones: plantilla, servicio: "pagos-api", criticidad: "Alta" }, hs);
  assert.deepEqual(rev.bloqueos, []);
  assert.equal(rev.historia.id, "HU-3101");
  assert.equal(revisarHistoriaEInstrucciones({ historia: "", instrucciones: "", servicio: "pagos-api" }, hs).bloqueos.length, 1);
});

test("modalidades con ejemplo, criticidades documentadas y grupos por rol", async () => {
  const flujo = await J("knowledge/ocd-flujo.json");
  for (const m of Object.values(flujo.modalidades)) assert.ok(m.ejemplo?.ocd && m.ejemplo.pasos.length && m.ejemplo.doc);
  for (const k of ["Alta", "Media", "Baja"]) assert.ok(cfg.criticidades[k].resumen && policy.criticidad[k] !== undefined);
  const dir = await J("knowledge/ocd-directorio.json");
  const porPerfil = (p) => Object.entries(dir.gruposRed).filter(([, g]) => g.perfil === p).map(([id]) => id).sort();
  assert.deepEqual(porPerfil("Líder técnico"), ["INCT_ADMIN_INCT_PROD", "VSDP-ADMIN"]);
  assert.deepEqual(porPerfil("Team Member"), ["INCT_DEVELOPER_INCT_PROD", "VSDP-DEVELOPER"]);
});
