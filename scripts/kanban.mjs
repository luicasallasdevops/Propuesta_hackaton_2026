// Mueve la tarjeta del ticket de pase en el tablero de GitHub Projects según el resultado del agente.
// Sin dependencias. El token solo se lee de GH_PROJECT_TOKEN y nunca se imprime.
const API = "https://api.github.com/graphql";

/** Columna destino según el estado del agente. */
export function pickOption(options, estado) {
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

async function main() {
  const { GH_PROJECT_TOKEN: token, PROJECT_OWNER: owner, PROJECT_NUMBER: number, ISSUE_NODE_ID: contentId, ESTADO: estado } = process.env;
  if (!token) { console.log("::notice::GH_PROJECT_TOKEN no está configurado: se omite el tablero."); return; }
  if (!owner || !number || !contentId || !estado) throw new Error("Faltan variables de entorno del tablero.");

  const proj = (await gql(token, PROJECT_QUERY, { o: owner, n: Number(number) })).repositoryOwner?.projectV2;
  if (!proj?.field) throw new Error("No encontré el tablero o su campo Status.");
  const option = pickOption(proj.field.options, estado);
  if (!option) throw new Error(`No hay una columna para el estado "${estado}".`);

  // Idempotente: si la tarjeta ya existe devuelve la misma.
  const itemId = (await gql(token, `mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id
    fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}`, { p: proj.id, c: contentId })).addProjectV2ItemById.item;
  if (!canMove(itemId.fieldValueByName?.name)) { console.log(`La tarjeta ya está en "${itemId.fieldValueByName.name}"; no se mueve.`); return; }

  await gql(token, `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}`,
    { p: proj.id, i: itemId.id, f: proj.field.id, o: option.id });
  console.log(`Tarjeta movida a "${option.name}".`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
