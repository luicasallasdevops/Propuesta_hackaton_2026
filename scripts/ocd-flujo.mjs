// Ejecuta el flujo OCD en GitHub Actions. MODO: flujo | historia | avisos.
// Escribe los resultados en /tmp y el workflow los aplica con gh. Nada del texto de usuarios se interpola en comandos:
// los datos llegan por variables de entorno y los comandos de gh se ejecutan sin shell (execFile con argumentos).
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { cargarBases } from "./ocd-eval.mjs";
import { decidirComando, decidirEvento, ocdDesdeHistoria, decidirAvisos } from "./ocd-accion.mjs";
import { rolesDeLogin, ocdDeTexto, estadoPorEtiquetas } from "./flujo.mjs";
import { moverTarjeta } from "./kanban.mjs";

const bases = await cargarBases();
const hoy = new Date().toISOString().slice(0, 10);
const leer = async (f) => JSON.parse(await readFile(f, "utf8"));
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", maxBuffer: 20e6 });
const ghJson = (...a) => JSON.parse(gh("api", ...a, "--paginate", "--slurp")).flat();

/** Etiquetas de estado con color: normal, rama (si algo falla) y final. */
const etiquetasDeEstado = () => Object.entries(bases.flujo.estados).map(([id, e]) => `estado:${id}|${e.final ? "2DA44E" : e.rama ? "D93F0B" : "1D76DB"}`).join("\n");

const salida = async (r, issue) => {
  if (!r?.responder) { console.log("Nada que hacer."); return; }
  await writeFile("/tmp/ocd-comentario.md", r.comentario);
  await writeFile("/tmp/ocd-numero.txt", String(issue.number));
  if (r.nuevoEstado) {
    await writeFile("/tmp/ocd-estado.txt", r.nuevoEstado);
    await writeFile("/tmp/ocd-quitar.txt", r.quitar.join(","));
    await writeFile("/tmp/ocd-nodo.txt", String(issue.node_id ?? ""));
    await writeFile("/tmp/ocd-etiquetas.txt", etiquetasDeEstado());
  }
  if (r.cerrar) await writeFile("/tmp/ocd-cerrar.txt", "1");
  console.log(r.nuevoEstado ? `Nuevo estado: ${r.nuevoEstado}` : "Solo responde.");
};

/** Tag ocd-<N>-<cert|prod|ratificado|revertir>. */
const tagEvento = (t) => { const m = String(t).match(/^ocd-(\d{1,6})-(cert|prod|ratificado|revertir)$/); return m ? { numero: Number(m[1]), evento: `tag:${m[2]}` } : null; };

const modo = process.env.MODO;
if (modo === "flujo") {
  const tipo = process.env.EVENTO_GH;
  const login = process.env.ACTOR_LOGIN ?? "";
  if (tipo === "issue_comment") {
    const ev = await leer(process.env.GITHUB_EVENT_PATH);
    await salida(decidirComando({ cuerpo: ev.comment.body, login, asociacion: ev.comment.author_association, issue: ev.issue, bases, hoy }), ev.issue);
  } else {
    let numero = null, evento = null, detalle = "";
    if (tipo === "push") { const t = tagEvento(process.env.TEXTO); if (t) { numero = t.numero; evento = t.evento; detalle = process.env.TEXTO; } }
    else { numero = ocdDeTexto(process.env.TEXTO); evento = tipo === "pull_request_review" ? "pr-aprobado" : "pr-abierto"; detalle = `PR #${process.env.PR_NUMERO ?? ""}`; }
    if (!numero || !evento) { console.log("El evento no menciona un OCD."); process.exit(0); }
    const issue = JSON.parse(gh("api", `repos/${process.env.GH_REPO}/issues/${numero}`));
    if (issue.pull_request) { console.log("El número no es un Issue."); process.exit(0); }
    await salida(decidirEvento({ evento, descripcionExtra: detalle, login, roles: rolesDeLogin(login, bases.roles), issue, bases, hoy }), issue);
  }
} else if (modo === "historia") {
  const ev = await leer(process.env.GITHUB_EVENT_PATH);
  const x = ocdDesdeHistoria({ titulo: ev.issue.title }, bases);
  if (!x) console.log("La historia no es una HU conocida: no se crea OCD.");
  else { await writeFile("/tmp/ocd-nuevo-titulo.txt", x.titulo); await writeFile("/tmp/ocd-nuevo-cuerpo.md", x.cuerpo); await writeFile("/tmp/ocd-nuevo-etiquetas.txt", x.etiquetas.join(",")); await writeFile("/tmp/ocd-etiquetas.txt", etiquetasDeEstado()); console.log(`Se creará: ${x.titulo}`); }
} else if (modo === "avisos") {
  const repo = process.env.GH_REPO;
  const abiertos = ghJson(`repos/${repo}/issues?state=open&labels=ocd&per_page=100`).filter((i) => !i.pull_request);
  const ocds = abiertos.map((i) => {
    const evs = ghJson(`repos/${repo}/issues/${i.number}/events?per_page=100`).filter((e) => e.event === "labeled" && /^estado:/.test(e.label?.name ?? ""));
    return { numero: i.number, labels: i.labels, desde: evs.at(-1)?.created_at ?? i.created_at };
  });
  const avisos = decidirAvisos({ ocds, hoy, bases });
  await writeFile("/tmp/ocd-avisos.json", JSON.stringify(avisos));
  console.log(`${avisos.length} aviso(s) por estancamiento.`);
} else if (modo === "sincronizar") {
  // Alinea las tarjetas del tablero con la etiqueta estado:* de cada OCD abierto (cubre los eventos de git, que no pueden usar el entorno kanban).
  const { GH_PROJECT_TOKEN: token, PROJECT_OWNER: owner, PROJECT_NUMBER: number } = process.env;
  if (!token) { console.log("::notice::GH_PROJECT_TOKEN no está configurado: se omite el tablero."); process.exit(0); }
  const abiertos = ghJson(`repos/${process.env.GH_REPO}/issues?state=open&labels=ocd&per_page=100`).filter((i) => !i.pull_request);
  let fallos = 0;
  for (const i of abiertos) {
    const estado = estadoPorEtiquetas(i.labels, bases.flujo);
    if (!i.labels.some((l) => l.name === `estado:${estado}`)) continue; // sin etiqueta de estado: lo maneja el agente
    try { console.log(`#${i.number}: ${await moverTarjeta({ token, owner, number, contentId: i.node_id, estado, forzar: true, flujo: bases.flujo })}`); }
    catch (e) { fallos++; console.error(`::error::#${i.number}: ${e.message}`); }
  }
  if (fallos) process.exit(1);
} else {
  console.error("::error::MODO desconocido"); process.exit(1);
}
