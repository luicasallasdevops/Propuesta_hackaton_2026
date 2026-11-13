// Mueve la tarjeta del ticket de pase en el tablero de GitHub Projects según el resultado del agente.
// Sin dependencias. El token solo se lee de GH_PROJECT_TOKEN y nunca se imprime.
import { readFile } from "node:fs/promises";
const API = "https://api.github.com/graphql";

const quitarAcentos = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Columna destino. `estado` es "Bloqueado", "Listo para aprobaciones" o el id de un estado del flujo OCD (con `flujo`).
 *  Para un estado del flujo se prefiere una columna con su nombre y, si el tablero no la tiene, la columna agrupadora del estado. */
export function pickOption(options, estado, flujo = null) {
  const e = flujo?.estados?.[estado];
  if (e) {
    const limpio = (t) => quitarAcentos(t).replace(/[^a-z0-9 ]/g, "").trim();
    const exacta = options.find((o) => limpio(o.name) === limpio(e.nombre)); // columna con el nombre exacto del estado
    return exacta ?? options.find((o) => limpio(o.name).includes(limpio(e.columna))) ?? null;
  }
  const clave = estado === "Bloqueado" ? "bloqueado" : "listo para aprobaciones";
  return options.find((o) => o.name.toLowerCase().includes(clave)) ?? null;
}

/** El agente solo administra las columnas iniciales; si una persona ya avanzó la tarjeta, no se toca. */
export function canMove(currentName) {
  const n = (currentName ?? "").toLowerCase();
  return !(n.includes("aprobado") || n.includes("producción") || n.includes("produccion"));
}

/** Busca el tablero y su campo Status; repositoryOwner sirve para personas y organizaciones. */
export const PROJECT_QUERY = `query($o:String!,$n:Int!){repositoryOwner(login:$o){... on ProjectV2Owner{projectV2(number:$n){id
  field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}}`;

async function gql(token, query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "agente-pase" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  return json.data;
}

/** Mueve la tarjeta de un Issue en el tablero. `forzar` (flujo OCD) permite moverla a cualquier columna. */
export async function moverTarjeta({ token, owner, number, contentId, estado, forzar = false, flujo = null }) {
  const proj = (await gql(token, PROJECT_QUERY, { o: owner, n: Number(number) })).repositoryOwner?.projectV2;
  if (!proj?.field) throw new Error("No encontré el tablero o su campo Status.");
  const option = pickOption(proj.field.options, estado, forzar ? flujo : null);
  if (!option) throw new Error(`No hay una columna para el estado "${estado}".`);

  // Idempotente: si la tarjeta ya existe devuelve la misma.
  const itemId = (await gql(token, `mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id
    fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}`, { p: proj.id, c: contentId })).addProjectV2ItemById.item;
  const actual = itemId.fieldValueByName?.name;
  if (!forzar && !canMove(actual)) return `La tarjeta ya está en "${actual}"; no se mueve.`;
  if (actual === option.name) return `La tarjeta ya está en "${option.name}".`;

  await gql(token, `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}`,
    { p: proj.id, i: itemId.id, f: proj.field.id, o: option.id });
  return `Tarjeta movida a "${option.name}".`;
}

async function main() {
  const { GH_PROJECT_TOKEN: token, PROJECT_OWNER: owner, PROJECT_NUMBER: number, ISSUE_NODE_ID: contentId, ESTADO: estado, FORZAR: forzar } = process.env;
  if (!token) { console.log("::notice::GH_PROJECT_TOKEN no está configurado: se omite el tablero."); return; }
  if (!owner || !number || !contentId || !estado) throw new Error("Faltan variables de entorno del tablero.");
  // Los estados del flujo OCD (FORZAR=1, desde el workflow ocd-flujo) pueden mover la tarjeta a cualquier columna.
  const flujo = forzar === "1" ? JSON.parse(await readFile("knowledge/ocd-flujo.json", "utf8")) : null;
  console.log(await moverTarjeta({ token, owner, number, contentId, estado, forzar: forzar === "1", flujo }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
