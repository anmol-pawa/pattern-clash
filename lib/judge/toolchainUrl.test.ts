import { describe, expect, it } from "vitest";
import { DEFAULT_TOOLCHAIN_URL, resolveToolchainUrl } from "./toolchainUrl";

describe("resolveToolchainUrl", () => {
  it.each([undefined, "", "   "])("defaults to same-origin /toolchain/ for %j", (raw) => {
    expect(resolveToolchainUrl(raw)).toBe(DEFAULT_TOOLCHAIN_URL);
  });

  it("adds a trailing slash to a root-relative path", () => {
    expect(resolveToolchainUrl("/static/tc")).toBe("/static/tc/");
  });

  it("keeps an absolute CDN URL and normalises the slash", () => {
    expect(resolveToolchainUrl("https://cdn.example.com/tc")).toBe("https://cdn.example.com/tc/");
    expect(resolveToolchainUrl("https://cdn.example.com/tc/")).toBe("https://cdn.example.com/tc/");
  });

  it("rejects a bare relative path that would resolve against the worker script", () => {
    expect(resolveToolchainUrl("toolchain")).toBe(DEFAULT_TOOLCHAIN_URL);
  });
});
