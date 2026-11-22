/**
 * Where the clang→WASM toolchain (bundle.js + llvm wasm + resources tar) is served from (ARCH §3.3).
 * `NEXT_PUBLIC_TOOLCHAIN_URL` may be a same-origin path ("/toolchain/") or an absolute CDN URL.
 * The bundle resolves its wasm files relative to itself, so only the directory matters.
 */
export const DEFAULT_TOOLCHAIN_URL = "/toolchain/";

export function resolveToolchainUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_TOOLCHAIN_URL;
  const isAbsolute = /^https?:\/\//i.test(value);
  if (!isAbsolute && !value.startsWith("/")) {
    // A bare relative path would resolve against the worker script, not the site root.
    return DEFAULT_TOOLCHAIN_URL;
  }
  return value.endsWith("/") ? value : `${value}/`;
}
