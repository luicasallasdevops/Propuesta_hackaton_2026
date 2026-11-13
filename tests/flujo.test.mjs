import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizarModalidad, analizarPasos, validarConjunto, validarConjuntos, plantillaConjunto, estadoPorEtiquetas, modalidadPorEtiquetas, etiquetaModalidad,
  transicionesDe, resolverEstado, ejecutaAutomatico, cadenaAutomatica, salidaDe, puedeMover, parseComando, renderFlujo, estancado, diasHabilesEntre,
  ocdDeTexto, eventoATransicion, rolesDeLogin, rolDeTexto, pendientesDeRol, avanzaSolo,
} from "../scripts/flujo.mjs";
import { cargarBases, evaluarOcd } from "../scripts/ocd-eval.mjs";

const J = async (f) => JSON.parse(await readFile(f, "utf8"));
const flujo = await J("knowledge/ocd-flujo.json");
const cfg = await J("knowledge/ocd.json");
const rolesCfg = await J("knowledge/ocd-roles.json");
const ctxSv = { servicio: "pagos-api", criticidad: "Alta" };

const todosAuto = (modalidad) => Object.fromEntries(Object.keys(flujo.conjuntos).map((k) => [k, plantillaConjunto(k, modalidad, { servicio: "pagos-api", historia: "HU-3101" })]));

test("el flujo tiene los 11 estados, ramas y transiciones consistentes", () => {
  assert.equal(Object.keys(flujo.estados).length, 11);
  for (const [id, e] of Object.entries(flujo.estados)) {
    assert.ok(flujo.roles[e.actor], `${id}: actor desconocido`);
    for (const t of transicionesDe(flujo, id)) assert.ok(flujo.estados[t.a], `${id} -> ${t.a}`);
    if (e.conjunto) assert.ok(flujo.conjuntos[e.conjunto]);
  }
  assert.deepEqual(Object.values(flujo.estados).filter((e) => e.rama).map((e) => e.nombre), ["Reversión de congelamiento", "Reversión de pase a producción", "Reversión"]);
  assert.deepEqual(transicionesDe(flujo, "ejecucion").map((t) => `${t.tipo}:${t.a}`), ["avance:ratificacion", "falla:rev_pase"]);
});

test("reconoce la modalidad por texto libre", () => {
  assert.equal(normalizarModalidad("100% automatizado"), "Automatizado");
  assert.equal(normalizarModalidad("Híbrido"), "Híbrido");
  assert.equal(normalizarModalidad("deploy go"), "DeployGO");
  assert.equal(normalizarModalidad("Manual"), "Manual");
  assert.equal(normalizarModalidad("otra"), "");
});

test("analiza pasos con etiquetas [AUTO] y [MANUAL] o por palabras clave", () => {
  const p = analizarPasos("1. [AUTO] Desplegar\n2. [MANUAL] Confirmar con QE\n3. Ejecutar el workflow ocd\n4. Avisar al canal");
  assert.deepEqual(p.map((x) => x.tipo), ["auto", "manual", "auto", null]);
});

test("las plantillas pasan la validación de cada modalidad", () => {
  for (const m of ["Automatizado", "Manual", "Híbrido", "DeployGO"]) {
    const v = validarConjuntos(todosAuto(m), m, ctxSv, flujo);
    assert.equal(v.ok, true, `${m}: ${v.bloqueos.join(" | ")}`);
  }
});

test("Automatizado rechaza pasos manuales o sin automatizar; Híbrido exige etiqueta en cada paso", () => {
  const mixto = "1. [AUTO] Desplegar con el workflow\n2. [MANUAL] Confirmar con QE en certificación";
  assert.equal(validarConjunto("congelamiento", mixto, "Automatizado", ctxSv, flujo).ok, false);
  assert.equal(validarConjunto("congelamiento", mixto, "Híbrido", ctxSv, flujo).ok, true);
  const sinTag = "1. Desplegar en certificación a mano\n2. Probar en certificación";
  const h = validarConjunto("congelamiento", sinTag, "Híbrido", ctxSv, flujo);
  assert.ok(h.bloqueos.some((b) => /sin etiqueta/.test(b)));
  assert.equal(validarConjunto("congelamiento", sinTag, "Manual", ctxSv, flujo).ok, true);
});

test("detecta secretos y comandos peligrosos en cualquiera de los cuatro conjuntos", () => {
  const v = validarConjunto("reversionDespliegue", "1. rm -rf /app en producción\n2. password=Abc12345 para entrar", "Manual", ctxSv, flujo);
  assert.equal(v.ok, false);
  assert.ok(v.bloqueos.length >= 2);
});

test("los conjuntos vacíos faltan pero no bloquean; los inválidos sí bloquean", () => {
  const v = validarConjuntos({ congelamiento: "", despliegue: "", reversionCongelamiento: "", reversionDespliegue: "" }, "Manual", ctxSv, flujo);
  assert.equal(v.faltan.length, 4); assert.equal(v.bloqueos.length, 0); assert.equal(v.ok, false); assert.equal(v.completo, false);
});

test("estado y modalidad se leen de las etiquetas del Issue", () => {
  assert.equal(estadoPorEtiquetas([{ name: "ocd" }, { name: "estado:seguridad" }], flujo), "seguridad");
  assert.equal(estadoPorEtiquetas(["estado:inventado"], flujo), "inicio");
  assert.equal(estadoPorEtiquetas([], flujo), "inicio");
  assert.equal(modalidadPorEtiquetas(["modalidad:hibrido"], flujo), "Híbrido");
  assert.equal(etiquetaModalidad("Híbrido"), "modalidad:hibrido");
  assert.equal(etiquetaModalidad("DeployGO"), "modalidad:deploygo");
});

test("resuelve estados por nombre, id o parte del nombre", () => {
  assert.equal(resolverEstado("Revisiones técnicas", flujo), "revisiones");
  assert.equal(resolverEstado("rev_pase", flujo), "rev_pase");
  assert.equal(resolverEstado("gestión de pase", flujo), "gestion_pase");
  assert.equal(resolverEstado("ejec", flujo), "ejecucion");
  assert.equal(resolverEstado("rev", flujo), null); // ambiguo
  assert.equal(resolverEstado("nada", flujo), null);
});

test("quién ejecuta cada estado: automático según la modalidad y los pasos", () => {
  const hib = validarConjuntos(todosAuto("Híbrido"), "Híbrido", ctxSv, flujo);
  assert.equal(ejecutaAutomatico("ejecucion", "Automatizado", null, flujo), true);
  assert.equal(ejecutaAutomatico("ejecucion", "Manual", null, flujo), false);
  assert.equal(ejecutaAutomatico("ejecucion", "Híbrido", hib, flujo), false); // el despliegue de la plantilla mezcla pasos manuales
  assert.equal(ejecutaAutomatico("revisiones", "Automatizado", null, flujo), false); // las revisiones son siempre humanas
  assert.equal(avanzaSolo("DeployGO", flujo), false);
  assert.equal(avanzaSolo("Automatizado", flujo), true);
});

test("la cadena automática avanza sola y simula la falla hacia la reversión", () => {
  assert.deepEqual(cadenaAutomatica("congelamiento", "Automatizado", null, flujo).map((x) => `${x.de}>${x.a}`), ["congelamiento>gestion_pase"]);
  assert.deepEqual(cadenaAutomatica("ejecucion", "Automatizado", null, flujo).map((x) => `${x.de}>${x.a}`), ["ejecucion>ratificacion"]);
  assert.deepEqual(cadenaAutomatica("ejecucion", "Automatizado", null, flujo, { falla: true }).map((x) => `${x.tipo}:${x.de}>${x.a}`), ["falla:ejecucion>rev_pase", "avance:rev_pase>reversion"]);
  assert.deepEqual(cadenaAutomatica("ejecucion", "Manual", null, flujo), []);
  assert.deepEqual(cadenaAutomatica("ejecucion", "DeployGO", null, flujo), []);
});

test("solo el rol del actor mueve el estado y se exigen los requisitos de salida", () => {
  const ok = validarConjuntos(todosAuto("Manual"), "Manual", ctxSv, flujo);
  const ctx = { conjuntosVal: ok, bloqueado: false };
  assert.equal(puedeMover({ desde: "inicio", hacia: "revisiones", roles: ["developer"], ctx, flujo }).ok, true);
  const noRol = puedeMover({ desde: "inicio", hacia: "revisiones", roles: ["qe"], ctx, flujo });
  assert.equal(noRol.ok, false); assert.match(noRol.motivo, /Solo Developer/);
  const falta = puedeMover({ desde: "inicio", hacia: "revisiones", roles: ["developer"], ctx: { conjuntosVal: { ok: false }, bloqueado: false }, flujo });
  assert.equal(falta.ok, false); assert.match(falta.motivo, /cuatro conjuntos/);
  const salto = puedeMover({ desde: "inicio", hacia: "ejecucion", roles: ["developer"], ctx, flujo });
  assert.equal(salto.ok, false); assert.match(salto.motivo, /puedes ir a/);
  assert.equal(puedeMover({ desde: "seguridad", hacia: "inicio", roles: ["analista-seguridad"], ctx: {}, flujo }).tipo, "devolver"); // devolver no exige requisitos
  assert.equal(puedeMover({ desde: "done", hacia: "inicio", roles: ["agileops"], ctx, flujo }).ok, false);
  assert.equal(salidaDe("inicio", { bloqueado: true }, flujo).find((c) => c.id === "sinBloqueos").ok, false);
});

test("el agente solo mueve por la automatización de estados automáticos", () => {
  const r = puedeMover({ desde: "ejecucion", hacia: "ratificacion", roles: [], esAgente: true, ctx: {}, flujo, modalidad: "Automatizado" });
  assert.equal(r.ok, true);
  assert.equal(puedeMover({ desde: "ejecucion", hacia: "ratificacion", roles: [], esAgente: true, ctx: {}, flujo, modalidad: "Manual" }).ok, false);
});

test("lee los comandos /ocd de un comentario", () => {
  assert.deepEqual(parseComando("/ocd mover revisiones técnicas", flujo), { cmd: "mover", destino: "revisiones", arg: "revisiones técnicas", falla: false });
  assert.equal(parseComando("/ocd mover ejecucion falla", flujo).falla, true);
  assert.equal(parseComando("/ocd mover ejecucion falla", flujo).destino, "ejecucion");
  assert.deepEqual(parseComando("/ocd estado", flujo), { cmd: "estado" });
  assert.deepEqual(parseComando("/ocd", flujo), { cmd: "estado" });
  assert.deepEqual(parseComando("/ocd devolver", flujo), { cmd: "devolver" });
  assert.equal(parseComando("/ocd mover nada", flujo).destino, null);
  assert.equal(parseComando("hola /ocd mover revisiones", flujo), null);
  assert.equal(parseComando("/ocdx mover revisiones", flujo)?.cmd ?? "x", "x");
});

test("el informe del flujo muestra estado, requisitos, instrucciones y cómo mover", () => {
  const cv = validarConjuntos({ ...todosAuto("Manual"), reversionDespliegue: "" }, "Manual", ctxSv, flujo);
  const md = renderFlujo({ id: "inicio", modalidad: "Manual", conjuntosVal: cv, ctx: { conjuntosVal: cv, bloqueado: false }, flujo });
  assert.match(md, /Inicio codificación \(1 de 11\)/);
  assert.match(md, /⬜ falta/);
  assert.match(md, /\/ocd mover revisiones/);
  assert.match(md, /\*\*Inicio codificación\*\* → Revisiones técnicas/);
});

test("avisa cuando un OCD lleva más días hábiles de los previstos", () => {
  assert.equal(diasHabilesEntre("2026-11-16", "2026-11-19", cfg), 3);
  assert.equal(diasHabilesEntre("2026-11-20", "2026-11-23", cfg), 1); // fin de semana no cuenta
  assert.equal(diasHabilesEntre("basura", "2026-11-23", cfg), 0);
  assert.equal(estancado({ id: "revisiones", desde: "2026-11-16T10:00:00Z", hoy: "2026-11-19", flujo, cfg }).vencido, true); // SLA 1
  assert.equal(estancado({ id: "revisiones", desde: "2026-11-18", hoy: "2026-11-19", flujo, cfg }).vencido, false);
  assert.equal(estancado({ id: "done", desde: "2026-01-05", hoy: "2026-11-19", flujo, cfg }).vencido, false);
});

test("DeployGO: los eventos de git mueven el estado solo si el estado actual lo permite", () => {
  assert.equal(ocdDeTexto("Cierra la historia. OCD #12"), 12);
  assert.equal(ocdDeTexto("ocd-37-prod"), 37);
  assert.equal(ocdDeTexto("sin número"), null);
  assert.equal(eventoATransicion({ evento: "pr-abierto", desde: "inicio", flujo }).hacia, "revisiones");
  assert.equal(eventoATransicion({ evento: "pr-abierto", desde: "seguridad", flujo }), null);
  assert.equal(eventoATransicion({ evento: "pr-aprobado", rolRevisor: "lider-tecnico", desde: "revisiones", flujo }).hacia, "seguridad");
  assert.equal(eventoATransicion({ evento: "pr-aprobado", rolRevisor: "qe", desde: "revisiones", flujo }), null);
  assert.equal(eventoATransicion({ evento: "tag:prod", desde: "gestion_pase", flujo }).hacia, "ejecucion");
  assert.equal(eventoATransicion({ evento: "tag:revertir", desde: "ratificacion", flujo }).hacia, "rev_pase");
});

test("roles por usuario de GitHub y por texto libre del chat", () => {
  assert.ok(rolesDeLogin("LuiCasallasDevops", rolesCfg).includes("developer"));
  assert.deepEqual(rolesDeLogin("desconocido", rolesCfg), []);
  assert.equal(rolDeTexto("soy líder técnico", flujo), "lider-tecnico");
  assert.equal(rolDeTexto("trabajo en seguridad", flujo), "analista-seguridad");
  assert.equal(rolDeTexto("hola", flujo), null);
  assert.deepEqual(pendientesDeRol("agileops", flujo).map((e) => e.id), ["congelamiento", "rev_congelamiento", "ejecucion", "rev_pase", "done"]);
});

test("el agente evalúa modalidad y cuatro conjuntos a partir del Issue Form", async () => {
  const bases = await cargarBases();
  const sets = todosAuto("Híbrido");
  const body = `### Servicio\n\npagos-api\n\n### Matrícula\n\nM-10212\n\n### Historia asociada\n\nHU-3101\n\n### Tipo de cambio\n\nNormal\n\n### Modalidad\n\nHíbrido\n\n### Criticidad del servicio\n\nAlta\n\n### Fecha de ejecución\n\n2026-11-24\n\n### Hora de inicio\n\n22:00\n\n### Plan de rollback\n\nSí, probado\n\n### Evidencias y controles\n\n${Object.values(bases.policy.controles).map((c) => `- [x] ${c.etiqueta}`).join("\n")}\n\n### Requisitos del OCD\n\n${Object.values(bases.cfg.controles).map((c) => `- [x] ${c.etiqueta}`).join("\n")}\n\n### Instrucciones de congelamiento\n\n${sets.congelamiento}\n\n### Instrucciones de despliegue\n\n${sets.despliegue}\n\n### Instrucciones de reversión de congelamiento\n\n${sets.reversionCongelamiento}\n\n### Instrucciones de reversión de despliegue\n\n${sets.reversionDespliegue}\n`;
  const ev = evaluarOcd({ issue: { number: 9, body, labels: [] }, bases, hoy: "2026-11-16" });
  assert.equal(ev.modalidad, "Híbrido");
  assert.equal(ev.conjuntosVal.ok, true, ev.conjuntosVal.bloqueos.join(" | "));
  assert.equal(ev.bloqueado, false, ev.result.blockers.join(" | "));
  // sin modalidad: se asume Manual y se avisa; un conjunto con secreto bloquea
  const malo = body.replace("### Modalidad\n\nHíbrido\n\n", "").replace("3. [MANUAL] Confirmar con QE", "3. password=Abc12345 en certificación");
  const ev2 = evaluarOcd({ issue: { number: 9, body: malo, labels: [] }, bases, hoy: "2026-11-16" });
  assert.equal(ev2.modalidad, "Manual");
  assert.ok(ev2.result.blockers.some((b) => /credencial|secreto/i.test(b)));
  assert.ok(ev2.result.advertencias.some((a) => /se asume Manual/.test(a)));
});
