import test from "node:test";
import assert from "node:assert/strict";
import { cargarBases } from "../scripts/ocd-eval.mjs";
import { decidirComando, decidirEvento, ocdDesdeHistoria, decidirAvisos, ejecutarMovimiento } from "../scripts/ocd-accion.mjs";
import { plantillaConjunto } from "../scripts/flujo.mjs";

const bases = await cargarBases();
const HOY = "2026-11-16";

/** Issue [OCD] completo y sin bloqueos, con la modalidad y el estado pedidos. */
function issue({ modalidad = "Manual", estado = "inicio", conjuntos = true, matricula = "M-10212", extra = "" } = {}) {
  const sets = Object.fromEntries(Object.keys(bases.flujo.conjuntos).map((k) => [k, conjuntos ? plantillaConjunto(k, modalidad, { servicio: "pagos-api", historia: "HU-3101" }) : ""]));
  const body = `### Servicio\n\npagos-api\n\n### Matrícula\n\n${matricula}\n\n### Historia asociada\n\nHU-3101\n\n### Tipo de cambio\n\nNormal\n\n### Modalidad\n\n${modalidad}\n\n### Criticidad del servicio\n\nAlta\n\n### Tamaño del cambio\n\nPequeño\n\n### Fecha de ejecución\n\n2026-11-24\n\n### Hora de inicio\n\n22:00\n\n### Plan de rollback\n\nSí, probado\n\n### Evidencias y controles\n\n${Object.values(bases.policy.controles).map((c) => `- [x] ${c.etiqueta}`).join("\n")}\n\n### Requisitos del OCD\n\n${Object.values(bases.cfg.controles).map((c) => `- [x] ${c.etiqueta}`).join("\n")}\n\n### Instrucciones de congelamiento\n\n${sets.congelamiento}\n\n### Instrucciones de despliegue\n\n${sets.despliegue}\n\n### Instrucciones de reversión de congelamiento\n\n${sets.reversionCongelamiento}\n\n### Instrucciones de reversión de despliegue\n\n${sets.reversionDespliegue}\n${extra}`;
  return { number: 7, title: "[OCD] pagos-api", body, labels: [{ name: "ocd" }, { name: `estado:${estado}` }] };
}
const cmd = (texto, login = "luicasallasdevops", i = issue(), asociacion = "OWNER") => decidirComando({ cuerpo: texto, login, asociacion, issue: i, bases, hoy: HOY });

test("un comentario que no es comando, o de alguien ajeno al equipo, no hace nada", () => {
  assert.equal(cmd("hola equipo").responder, false);
  assert.equal(cmd("/ocd mover revisiones", "x", issue(), "NONE").responder, false);
  assert.equal(decidirComando({ cuerpo: "/ocd estado", login: "x", asociacion: "OWNER", issue: { ...issue(), title: "[Pase] otro" }, bases, hoy: HOY }).responder, false);
});

test("/ocd estado muestra el estado sin mover nada", () => {
  const r = cmd("/ocd estado");
  assert.equal(r.responder, true); assert.equal(r.nuevoEstado, null);
  assert.match(r.comentario, /Inicio codificación \(1 de 11\)/);
});

test("el developer pasa de Inicio a Revisiones técnicas cuando las instrucciones son válidas", () => {
  const r = cmd("/ocd mover revisiones técnicas");
  assert.equal(r.nuevoEstado, "revisiones");
  assert.deepEqual(r.quitar, ["estado:inicio"]);
  assert.match(r.comentario, /movió el OCD: Inicio codificación → Revisiones técnicas/);
});

test("sin los cuatro conjuntos no avanza, y un usuario sin rol no mueve nada", () => {
  const sin = cmd("/ocd mover revisiones", "luicasallasdevops", issue({ conjuntos: false }));
  assert.equal(sin.nuevoEstado, null); assert.match(sin.comentario, /cuatro conjuntos/);
  const ajeno = cmd("/ocd mover revisiones", "otra-persona");
  assert.equal(ajeno.nuevoEstado, null); assert.match(ajeno.comentario, /no tiene un rol/);
  const salto = cmd("/ocd mover done");
  assert.equal(salto.nuevoEstado, null); assert.match(salto.comentario, /No se puede pasar/);
});

test("Automatizado: al entrar en Congelamiento se ejecuta solo y llega a Gestión de pase", () => {
  const r = cmd("/ocd mover congelamiento", "luicasallasdevops", issue({ modalidad: "Automatizado", estado: "seguridad" }));
  assert.equal(r.nuevoEstado, "gestion_pase");
  assert.match(r.comentario, /Automático \(Automatizado\): Congelamiento → Gestión de pase/);
});

test("Automatizado: una ejecución que falla pasa sola por la reversión hasta Reversión", () => {
  const r = cmd("/ocd mover ejecucion falla", "luicasallasdevops", issue({ modalidad: "Automatizado", estado: "gestion_pase" }));
  assert.equal(r.nuevoEstado, "reversion");
  assert.match(r.comentario, /falló: se revierte/);
});

test("Manual: la ejecución espera a agileOps; /ocd falla y /ocd devolver usan las ramas", () => {
  const e = cmd("/ocd mover ejecucion", "luicasallasdevops", issue({ estado: "gestion_pase" }));
  assert.equal(e.nuevoEstado, "ejecucion");
  const f = cmd("/ocd falla", "luicasallasdevops", issue({ estado: "ratificacion" }));
  assert.equal(f.nuevoEstado, "rev_pase");
  const d = cmd("/ocd devolver", "luicasallasdevops", issue({ estado: "seguridad" }));
  assert.equal(d.nuevoEstado, "inicio");
  const sinRama = cmd("/ocd falla", "luicasallasdevops", issue({ estado: "inicio" }));
  assert.equal(sinRama.nuevoEstado, null);
});

test("llegar a Done cierra el pase", () => {
  const r = cmd("/ocd mover done", "luicasallasdevops", issue({ estado: "ratificacion" }));
  assert.equal(r.nuevoEstado, "done"); assert.equal(r.cerrar, true);
});

test("el rol manda: un QE no puede aprobar la revisión técnica", () => {
  const mov = ejecutarMovimiento({ cur: "revisiones", hacia: "seguridad", roles: ["qe"], ev: { conjuntosVal: { ok: true }, bloqueado: false, modalidad: "Manual" }, flujo: bases.flujo, quien: "qe1" });
  assert.equal(mov.ok, false); assert.match(mov.motivo, /Líder técnico/);
});

test("DeployGO: los eventos de git mueven el estado y no avanzan solos", () => {
  const dg = (estado) => issue({ modalidad: "DeployGO", estado });
  const roles = ["developer", "lider-tecnico", "analista-seguridad", "agileops", "gestor-cambios", "qe"];
  const ev = (evento, estado, extra = {}) => decidirEvento({ evento, login: "luicasallasdevops", roles, issue: dg(estado), bases, hoy: HOY, ...extra });
  assert.equal(ev("pr-abierto", "inicio").nuevoEstado, "revisiones");
  assert.equal(ev("pr-aprobado", "revisiones").nuevoEstado, "seguridad");
  assert.equal(ev("pr-aprobado", "seguridad").nuevoEstado, "congelamiento");
  assert.equal(ev("tag:cert", "congelamiento").nuevoEstado, "gestion_pase");
  assert.equal(ev("tag:prod", "gestion_pase").nuevoEstado, "ejecucion"); // sin cadena automática
  assert.equal(ev("tag:revertir", "ejecucion").nuevoEstado, "rev_pase");
  assert.equal(ev("tag:ratificado", "ratificacion").nuevoEstado, "done");
  assert.equal(ev("tag:prod", "inicio").responder, false); // no corresponde al estado
  // un OCD que no es DeployGO ignora los eventos
  assert.equal(decidirEvento({ evento: "pr-abierto", login: "x", roles, issue: issue({ modalidad: "Manual" }), bases, hoy: HOY }).responder, false);
  // sin el rol correcto, avisa y no mueve
  const sinRol = decidirEvento({ evento: "pr-aprobado", login: "x", roles: ["qe"], issue: dg("revisiones"), bases, hoy: HOY });
  assert.equal(sinRol.responder, false);
  const noPuede = decidirEvento({ evento: "pr-abierto", login: "x", roles: ["qe"], issue: dg("inicio"), bases, hoy: HOY });
  assert.equal(noPuede.nuevoEstado, null); assert.match(noPuede.comentario, /Solo Developer/);
});

test("DeployGO nace de la historia: [HU-####] crea el OCD con la modalidad y el servicio", () => {
  const x = ocdDesdeHistoria({ titulo: "[HU-3101] Nuevo límite de montos" }, bases);
  assert.match(x.titulo, /^\[OCD\] pagos-api · HU-3101 \(DeployGO\)$/);
  assert.match(x.cuerpo, /### Modalidad\n\nDeployGO/);
  assert.deepEqual(x.etiquetas, ["ocd", "modalidad:deploygo", "estado:inicio"]);
  assert.equal(ocdDesdeHistoria({ titulo: "[HU-9999] no existe" }, bases), null);
  assert.equal(ocdDesdeHistoria({ titulo: "Otra cosa" }, bases), null);
});

test("avisos: solo los OCD que pasaron su plazo en el estado, con el rol y el siguiente paso", () => {
  const ocds = [
    { numero: 4, labels: [{ name: "estado:revisiones" }], desde: "2026-11-12T10:00:00Z" },
    { numero: 5, labels: [{ name: "estado:revisiones" }], desde: "2026-11-16T10:00:00Z" },
    { numero: 6, labels: [{ name: "estado:done" }], desde: "2026-01-05T10:00:00Z" },
  ];
  const a = decidirAvisos({ ocds, hoy: "2026-11-17", bases });
  assert.deepEqual(a.map((x) => x.numero), [4]);
  assert.match(a[0].comentario, /Líder técnico/);
  assert.match(a[0].comentario, /@luicasallasdevops/);
  assert.match(a[0].comentario, /ocd-aviso:revisiones:2026-11-17/);
});
