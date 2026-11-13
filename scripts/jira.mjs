// Refleja el OCD de GitHub en el tablero de Jira (REST v3). Sin dependencias.
// GitHub sigue siendo la fuente del estado: Jira es el espejo que ve el negocio. El token solo se lee de JIRA_API_TOKEN y nunca se imprime.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const leer = async (f) => JSON.parse(await readFile(new URL(f, import.meta.url), "utf8"));

/** Estado de Jira (nombre) para un estado del flujo OCD. */
export function estadoJira(mapa, estado) {
  return mapa.estados?.[estado] ?? null;
}

/** Etiquetas de la incidencia: base + identificador del OCD + estado exacto. Jira no admite espacios en etiquetas. */
export function etiquetasJira(mapa, numero, estado) {
  return [...mapa.etiquetasBase, `${mapa.prefijoEtiquetaOcd}${numero}`, `${mapa.prefijoEtiquetaEstado}${String(estado).replace(/[^a-z0-9_-]/g, "")}`];
}

/** Descripción en formato ADF con enlace al Issue de GitHub. */
export function descripcionAdf(texto, url) {
  const parr = (nodos) => ({ type: "paragraph", content: nodos });
  return { type: "doc", version: 1, content: [
    parr([{ type: "text", text: texto }]),
    parr([{ type: "text", text: "Fuente del estado: ", marks: [{ type: "strong" }] }, { type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }]),
  ] };
}

export function clienteJira({ baseUrl, email, token, fetchFn = fetch }) {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/.test(base)) throw new Error("JIRA_BASE_URL debe ser https://<sitio>.atlassian.net");
  const auth = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  const pedir = async (metodo, ruta, cuerpo) => {
    const res = await fetchFn(`${base}${ruta}`, { method: metodo, headers: { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    if (!res.ok) throw new Error(`Jira ${metodo} ${ruta.split("?")[0]} → HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
  return { pedir, base };
}

/** Crea la incidencia del OCD si no existe (se identifica por su etiqueta) y la deja en el estado que corresponde. */
export async function sincronizarOcd({ jira, mapa, numero, titulo, url, estado }) {
  const destino = estadoJira(mapa, estado);
  if (!destino) throw new Error(`El estado "${estado}" no está en el mapa de Jira.`);
  const etiquetaOcd = `${mapa.prefijoEtiquetaOcd}${numero}`;
  const jql = `project = ${mapa.proyecto} AND labels = "${etiquetaOcd}"`;
  const busca = await jira.pedir("GET", `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=status,labels`);
  let incidencia = busca.issues?.[0];
  let accion = "existente";
  if (!incidencia) {
    const nueva = await jira.pedir("POST", "/rest/api/3/issue", { fields: {
      project: { key: mapa.proyecto }, issuetype: { name: mapa.tipoIncidencia },
      summary: String(titulo).slice(0, 250), labels: etiquetasJira(mapa, numero, estado),
      description: descripcionAdf(`OCD #${numero} creado por el agente DevSecOps desde GitHub.`, url),
    } });
    incidencia = { key: nueva.key, fields: { status: { name: "Tareas por hacer" }, labels: etiquetasJira(mapa, numero, estado) } };
    accion = "creada";
  } else {
    // Mantiene la etiqueta del estado exacto al día.
    const previas = incidencia.fields?.labels ?? [];
    const sinEstado = previas.filter((l) => !l.startsWith(mapa.prefijoEtiquetaEstado));
    const nuevas = etiquetasJira(mapa, numero, estado).filter((l) => l.startsWith(mapa.prefijoEtiquetaEstado));
    if (!nuevas.every((l) => previas.includes(l)) || previas.length !== sinEstado.length + 1)
      await jira.pedir("PUT", `/rest/api/3/issue/${incidencia.key}`, { fields: { labels: [...sinEstado, ...nuevas] } });
  }
  const actual = incidencia.fields?.status?.name;
  if (actual === destino) return `${incidencia.key} ${accion}; ya está en "${destino}".`;
  const { transitions } = await jira.pedir("GET", `/rest/api/3/issue/${incidencia.key}/transitions`);
  const t = transitions.find((x) => x.to?.name === destino);
  if (!t) throw new Error(`${incidencia.key}: no hay transición hacia "${destino}".`);
  await jira.pedir("POST", `/rest/api/3/issue/${incidencia.key}/transitions`, { transition: { id: t.id } });
  return `${incidencia.key} ${accion}; movida a "${destino}" (estado OCD: ${estado}).`;
}

async function main() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, GH_REPO, MODO = "uno", ISSUE, ESTADO } = process.env;
  if (!JIRA_API_TOKEN || !JIRA_EMAIL) { console.log("::notice::JIRA_EMAIL o JIRA_API_TOKEN no están configurados: se omite Jira."); return; }
  const mapa = await leer("../knowledge/ocd-jira.json");
  const flujo = await leer("../knowledge/ocd-flujo.json");
  const { estadoPorEtiquetas } = await import("./flujo.mjs");
  const jira = clienteJira({ baseUrl: JIRA_BASE_URL ?? "https://rochadavid0797.atlassian.net", email: JIRA_EMAIL, token: JIRA_API_TOKEN });
  const gh = (...a) => JSON.parse(execFileSync("gh", a, { encoding: "utf8", maxBuffer: 20e6 }));
  const issues = MODO === "todos"
    ? gh("api", `repos/${GH_REPO}/issues?state=all&labels=ocd&per_page=100`).filter((i) => !i.pull_request)
    : [gh("api", `repos/${GH_REPO}/issues/${Number(ISSUE)}`)];
  let fallos = 0;
  for (const i of issues) {
    const estado = ESTADO || estadoPorEtiquetas(i.labels, flujo);
    try { console.log(`#${i.number}: ${await sincronizarOcd({ jira, mapa, numero: i.number, titulo: i.title, url: i.html_url, estado })}`); }
    catch (e) { fallos++; console.error(`::error::#${i.number}: ${e.message}`); }
  }
  if (fallos) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
