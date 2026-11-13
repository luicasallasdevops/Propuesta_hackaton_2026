// Piezas de interfaz compartidas por el chat: detalle colapsado con fuente, campo de texto y ventana emergente.
// Solo nodos DOM y textContent (sin innerHTML).
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat(Infinity).forEach((k) => n.append(k));
  return n;
};

const FALLBACK_REPO = "hybridcloudcompany/Grupo11";
export const repo = (() => {
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  const name = location.pathname.split("/")[1];
  return m && name ? `${m[1]}/${name}` : FALLBACK_REPO;
})();

/** Enlace a un archivo del repositorio (documentación y conocimiento) o a una página de la wiki. */
export const docUrl = (ruta) => (ruta.startsWith("wiki:") ? `https://github.com/${repo}/wiki/${ruta.slice(5)}` : `https://github.com/${repo}/blob/main/${ruta}`);

/** Enlace externo seguro. */
export const enlace = (texto, ruta, clase = "") => el("a", { href: docUrl(ruta), textContent: texto, target: "_blank", rel: "noopener noreferrer", className: clase });

/** Detalle colapsado: no compite con la acción que se pide; al final enlaza la documentación de donde sale. */
export function detalle(titulo, contenido, doc) {
  const d = el("details", { className: "det" }, el("summary", { textContent: titulo }), el("div", { className: "det-body" }, contenido));
  if (doc) d.lastChild.append(el("p", { className: "fuente" }, "📄 Fuente: ", enlace(doc.texto, doc.ruta)));
  return d;
}

/** Campo de texto dentro del mensaje (en vez de elegir de una lista). */
export function campoTexto({ etiqueta, placeholder, boton, maxLength = 40, onEnviar }) {
  const input = el("input", { type: "text", placeholder, maxLength, autocomplete: "off", ariaLabel: etiqueta, className: "campo-in" });
  const f = el("form", { className: "campo" }, input, el("button", { type: "submit", className: "qr solid", textContent: boton }));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    input.disabled = true; f.querySelector("button").disabled = true;
    onEnviar(v);
  });
  setTimeout(() => input.focus(), 50);
  return f;
}

/** Ventana emergente con contenido embebido (usa el <dialog id="dlg"> de la página). */
export function abrirDialogo(titulo, contenido, doc) {
  const dlg = document.getElementById("dlg");
  if (!dlg || typeof dlg.showModal !== "function") return false;
  const cerrar = el("button", { type: "button", className: "dlg-x", textContent: "✕", ariaLabel: "Cerrar", onclick: () => dlg.close() });
  dlg.replaceChildren(el("div", { className: "dlg-head" }, el("h2", { id: "dlg-t", textContent: titulo }), cerrar), el("div", { className: "dlg-body" }, contenido),
    doc ? el("p", { className: "fuente" }, "📄 Documentación completa: ", enlace(doc.texto, doc.ruta)) : "");
  dlg.showModal();
  return true;
}

/** Comando con botón «Copiar». `por` explica en una frase para qué sirve. */
export function comandoCopiable(texto, por = "") {
  const b = el("button", { type: "button", textContent: "Copiar" });
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texto); b.textContent = "Copiado ✓"; } catch { b.textContent = "Selecciónalo y copia"; }
    setTimeout(() => { b.textContent = "Copiar"; }, 1800);
  });
  return el("div", { className: "cmd" }, el("code", { textContent: texto }), b, por ? el("span", { className: "cmd-why", textContent: por }) : "");
}
