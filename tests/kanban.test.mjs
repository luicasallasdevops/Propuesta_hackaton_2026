import test from "node:test";
import assert from "node:assert/strict";
import { pickOption, canMove } from "../scripts/kanban.mjs";

const opts = [
  { id: "1", name: "📥 Solicitado" }, { id: "2", name: "🚨 Bloqueado" },
  { id: "3", name: "✅ Listo para aprobaciones" }, { id: "4", name: "🔐 Aprobado" }, { id: "5", name: "🚀 En producción" },
];

test("elige la columna según el estado del agente", () => {
  assert.equal(pickOption(opts, "Bloqueado").id, "2");
  assert.equal(pickOption(opts, "Listo para aprobaciones").id, "3");
  assert.equal(pickOption([], "Bloqueado"), null);
});

test("no mueve tarjetas que una persona ya avanzó", () => {
  assert.equal(canMove("📥 Solicitado"), true);
  assert.equal(canMove("🚨 Bloqueado"), true);
  assert.equal(canMove(undefined), true);
  assert.equal(canMove("🔐 Aprobado"), false);
  assert.equal(canMove("🚀 En producción"), false);
});
