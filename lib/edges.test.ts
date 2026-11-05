// Run: node --test lib/edges.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { zigzag } from "./edges.ts";

test("zigzag builds a closed polygon with the right point count", () => {
  const p = zigzag({ top: true, bottom: true, teeth: 4, depth: 8 });
  assert.ok(p.startsWith("polygon(0.000% 8px"));
  assert.equal(p.split(",").length, 10);
  assert.equal(zigzag(), "polygon(0 0, 100% 0, 100% 100%, 0 100%)");
});
