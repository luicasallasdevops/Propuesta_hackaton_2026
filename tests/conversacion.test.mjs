import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { intencion, extraerDatos, mezclar, faltantes, respuestaACampo, evaluarCambio, precargaOcd, fechaDeTexto } from "../scripts/conversacion.mjs";

const L = (f) => JSON.parse(readFileSync(new URL(`../knowledge/${f}`, import.meta.url)));
const env = { policy: L("policy.json"), cfg: L("ocd.json"), cal: L("ocd-calendario.json"), incidents: L("incidents.json"), hoy: "2026-11-16" };
const ctx = { servicios: Object.keys(L("ocd-directorio.json").servicios), hoy: "2026-11-16" }; // lunes

test("saludos, gracias y menú se reconocen sin confundir preguntas de estándares", () => {
  assert.equal(intencion("Hola"), "saludo");
  assert.equal(intencion("Buenos días, ¿cómo estás?"), "saludo");
  assert.equal(intencion("muchas gracias"), "gracias");
  assert.equal(intencion("¿qué puedes hacer?"), "menu");
  assert.equal(intencion("¿Cómo creo un ticket de pase a producción?"), "evaluar"); // el chat exige datos para evaluar
  assert.equal(intencion("¿Qué rol necesito?"), "otra");
});

test("extrae servicio, día, rollback y más de una frase libre", () => {
  assert.deepEqual(extraerDatos("Necesito desplegar pagos-api este viernes y todavía no tengo rollback", ctx), { servicio: "pagos-api", fecha: "2026-11-20", rollback: "No" });
  assert.deepEqual(extraerDatos("criticidad alta y ya probé el rollback", ctx), { criticidad: "Alta", rollback: "Sí, probado" });
  assert.equal(extraerDatos("tengo plan de rollback", ctx).rollback, "Sí, sin probar");
  assert.equal(extraerDatos("a las 23:00", ctx).hora, "23:00");
  assert.deepEqual(extraerDatos("sin SAST y sin escaneo de secretos", ctx).faltan.sort(), ["sast", "secretos"]);
  assert.deepEqual(extraerDatos("¿cómo está el clima?", ctx), {});
});

test("entiende fechas relativas, con nombre de mes y numéricas", () => {
  const f = (t) => fechaDeTexto(t, "2026-11-16");
  assert.equal(f("mañana"), "2026-11-17");
  assert.equal(f("pasado mañana"), "2026-11-18");
  assert.equal(f("el martes"), "2026-11-17");
  assert.equal(f("el próximo lunes"), "2026-11-23");
  assert.equal(f("el 24 de noviembre"), "2026-11-24");
  assert.equal(f("el 3/12"), "2026-12-03");
  assert.equal(f("el 5 de enero"), "2027-01-05");
  assert.equal(f("2026-11-25"), "2026-11-25");
  assert.equal(f("el 31 de febrero"), null);
});

test("el contexto se conserva: un cambio de fecha no pierde lo anterior", () => {
  let c = mezclar({}, extraerDatos("desplegar pagos-api el viernes sin rollback", ctx)).cambio;
  assert.deepEqual(faltantes(c), []);
  const m = mezclar(c, extraerDatos("mejor el martes", ctx));
  assert.equal(m.cambio.servicio, "pagos-api");
  assert.equal(m.cambio.rollback, "No");
  assert.equal(m.cambio.fecha, "2026-11-17");
  assert.deepEqual(m.cambios, [{ campo: "fecha", de: "2026-11-20", a: "2026-11-17" }]);
});

test("solo pregunta lo que falta y entiende respuestas cortas", () => {
  assert.deepEqual(faltantes({}), ["servicio", "fecha", "rollback"]);
  assert.deepEqual(faltantes({ servicio: "pagos-api", fecha: "2026-11-24" }), ["rollback"]);
  assert.deepEqual(respuestaACampo("rollback", "no, todavía no"), { rollback: "No" });
  assert.deepEqual(respuestaACampo("rollback", "sí, ya lo tengo"), { rollback: "Sí, sin probar" });
  assert.deepEqual(respuestaACampo("rollback", "sí y está probado"), { rollback: "Sí, probado" });
});

test("el caso del viernes sin rollback: detecta, propone fecha válida y deja traza", () => {
  const cambio = mezclar({}, extraerDatos("Necesito desplegar pagos-api este viernes y todavía no tengo rollback", ctx)).cambio;
  const e = evaluarCambio(cambio, env);
  assert.equal(e.r.estado, "Bloqueado");
  assert.ok(e.r.blockers.some((b) => /rollback/i.test(b)));
  assert.ok(e.r.blockers.some((b) => /ventana/i.test(b)));
  assert.equal(e.fechaSugerida, "2026-11-24");
  assert.match(e.sugeridaTxt, /martes/);
  assert.ok(e.traza.consulto.length >= 4 && e.traza.detecto.length >= 2 && e.traza.propone.length >= 1);
  assert.match(e.traza.accion, /Crítico|Alto|Medio|Bajo/);
  assert.ok(e.supuestos.length > 0, "declara lo que supuso");
});

test("con fecha válida y rollback probado ya no bloquea y precarga el OCD", () => {
  const cambio = { servicio: "canal-web", fecha: "2026-11-24", rollback: "Sí, probado", faltan: [] };
  const e = evaluarCambio(cambio, env);
  assert.equal(e.r.estado, "Listo para aprobaciones");
  assert.deepEqual(precargaOcd(cambio), { servicio: "canal-web", rollback: "Sí, probado", fecha: "2026-11-24" });
  assert.equal(precargaOcd({ ...cambio, fecha: "2026-11-20" }, "2026-11-24").fecha, "2026-11-24");
});

test("un control faltante declarado por el usuario sube el riesgo y bloquea", () => {
  const base = { servicio: "canal-web", fecha: "2026-11-24", rollback: "Sí, probado", faltan: [] };
  const sin = evaluarCambio({ ...base, faltan: ["sast"] }, env);
  assert.equal(sin.r.estado, "Bloqueado");
  assert.ok(sin.r.score > evaluarCambio(base, env).r.score);
});
