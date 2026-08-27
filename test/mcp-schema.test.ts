import assert from "node:assert/strict";
import { test } from "node:test";
import { nodesSchema } from "../src/lib/mcp-schema";
import { normalizeNodes } from "../src/lib/boards";
import { BLOCK_TYPES } from "../src/lib/blocks";
import { LIMITS } from "../src/lib/limits";

/** What an agent writes by hand: `parent`, `blocks`, bare type strings, and a
 *  child declared before the parent it points at. */
const pushed = [
  { id: "docs", parent: "home", title: "Docs", blocks: ["breadcrumb", { type: "text", label: "Intro" }] },
  { id: "home", title: "Home", color: "blue", notes: "landing", tags: ["a", "b"], seo: { title: "Home" },
    blocks: [{ type: "hero", label: "Ship faster" }, "cards", "footer"] },
  { parent: "docs", title: "Changelog", blocks: ["timeline"] },
];

/** Push a shape through the schema the way the MCP tool does, then normalize. */
const push = (nodes: unknown) => normalizeNodes(nodesSchema.parse(nodes));

const shape = (nodes: ReturnType<typeof normalizeNodes>) =>
  nodes.map((n) => `${n.id}<${n.parentId ?? "root"}>:${n.wireframes.map((w) => w.type + (w.label ? `(${w.label})` : "")).join("+")}`).sort();

test("accepts the hand-written shape, resolving forward parent references", () => {
  const nodes = push(pushed);
  assert.equal(nodes.length, 3);
  assert.equal(nodes.find((n) => n.id === "home")!.parentId, null);
  assert.equal(nodes.find((n) => n.id === "docs")!.parentId, "home");
  // the node with no id of its own is auto-assigned one and keeps its parent
  const auto = nodes.find((n) => n.title === "Changelog")!;
  assert.match(auto.id, /^n\d+$/);
  assert.equal(auto.parentId, "docs");
});

test("bare strings and { type, label } both become blocks", () => {
  const home = push(pushed).find((n) => n.id === "home")!;
  assert.deepEqual(
    home.wireframes.map((w) => [w.type, w.label]),
    [["hero", "Ship faster"], ["cards", undefined], ["footer", undefined]],
  );
});

/* The regression this file exists for. A board read back from the API uses
 * `parentId` and `wireframes`; the schema must let both through, because zod
 * strips what it does not declare and the loss is silent — the tree flattens
 * and every block disappears while the call still reports success. */
test("a board read back from the API survives being pushed again unchanged", () => {
  const first = push(pushed);
  const again = push(first);

  assert.deepEqual(shape(again), shape(first));
  assert.equal(
    again.filter((n) => n.parentId === null).length,
    1,
    "re-pushing must not flatten the tree into roots",
  );
  assert.equal(
    again.reduce((sum, n) => sum + n.wireframes.length, 0),
    first.reduce((sum, n) => sum + n.wireframes.length, 0),
    "re-pushing must not drop blocks",
  );
});

test("round-trip keeps the fields that only exist on a read-back node", () => {
  const home = push(push(pushed)).find((n) => n.id === "home")!;
  assert.equal(home.color, "blue");
  assert.equal(home.notes, "landing");
  assert.deepEqual(home.tags, ["a", "b"]);
  assert.deepEqual(home.seo, { title: "Home" });
});

test("explicit `parent` wins over a stale `parentId` on the same node", () => {
  const [n] = push([{ id: "a", title: "A" }, { id: "b", parent: null, parentId: "a", title: "B" }]).filter(
    (x) => x.id === "b",
  );
  assert.equal(n.parentId, null);
});

test("every published block type is accepted", () => {
  const nodes = push([{ id: "all", title: "All", blocks: BLOCK_TYPES.slice(0, LIMITS.blocksPerNode) }]);
  assert.equal(nodes[0].wireframes.length, Math.min(BLOCK_TYPES.length, LIMITS.blocksPerNode));
});

test("an unknown block type is rejected rather than silently dropped", () => {
  assert.throws(() => push([{ id: "a", title: "A", blocks: ["carousel"] }]));
});

test("a parent outside the push is rejected", () => {
  assert.throws(() => push([{ id: "a", parent: "ghost", title: "A" }]), /parent "ghost"/);
});

test("a cycle is rejected", () => {
  assert.throws(
    () => push([{ id: "a", parent: "b", title: "A" }, { id: "b", parent: "a", title: "B" }]),
    /own ancestor/,
  );
});

test("an empty push is rejected by the schema, not by the normalizer", () => {
  assert.throws(() => nodesSchema.parse([]));
});
