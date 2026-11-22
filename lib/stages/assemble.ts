/** Turns a problem's component cards back into the `class Solution` they were cut from (GDD §6 "components assemble"). */
import type { FunctionSpec } from "@/lib/judge/harness/driver";
import type { StageProblem } from "./types";

const INDENT = "        ";

function signature(spec: FunctionSpec): string {
  const params = spec.params.map((p) => `${p.type} ${p.name}`).join(", ");
  return `${spec.returns} ${spec.name}(${params})`;
}

export function assemble(problem: StageProblem): string {
  const body = problem.components.flatMap((c) => c.lines).map((line) => INDENT + line);
  return ["class Solution {", "public:", `    ${signature(problem.driver)} {`, ...body, "    }", "};", ""].join("\n");
}

/** "nums = [3, 8, 5, 12], target = 17" → harness lines "[3,8,5,12]\n17" (one LC literal per parameter, in order). */
export function sampleToHarness(input: string): string {
  return input
    .split(/,\s*(?=[A-Za-z_]\w*\s*=)/)
    .map((part) => part.slice(part.indexOf("=") + 1).trim().replace(/\s+/g, ""))
    .join("\n");
}
