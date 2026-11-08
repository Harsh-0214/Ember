import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("allows relative paths only", () => {
    expect(safeNext("/log?x=1")).toBe("/log?x=1");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null, "/more")).toBe("/more");
  });
});
