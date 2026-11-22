"use client";

import { useState } from "react";
import { compileCpp, runWasm } from "@/lib/judge/client";
import { judgeProblem } from "@/lib/judge/judge";
import type { FunctionSpec } from "@/lib/judge/harness/driver";
import styles from "./page.module.css";

const PAIR_SUM: FunctionSpec = {
  kind: "function",
  name: "twoSum",
  returns: "vector<int>",
  params: [
    { type: "vector<int>&", name: "nums" },
    { type: "int", name: "target" },
  ],
};

const PAIR_SUM_TESTS = [
  { input: "[2,7,11,15]\n9", expected: "[0,1]" },
  { input: "[3,2,4]\n6", expected: "[1,2]" },
  { input: "[3,3]\n6", expected: "[0,1]" },
];

const SAMPLE = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    // Invariant: seen holds value -> index for every element left of i.
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    int n; cin >> n;
    vector<int> v(n);
    for (auto& x : v) cin >> x;
    int target; cin >> target;
    Solution s;
    auto r = s.twoSum(v, target);
    cout << r[0] << " " << r[1] << "\\n";
}
`;

/** Judge playground (ARCH §3): compile and run C++ in workers, report timings, judge a pair-sum sample. */
export default function DevJudge() {
  const [src, setSrc] = useState(SAMPLE);
  const [stdin, setStdin] = useState("4\n2 7 11 15\n9\n");
  const [flag, setFlag] = useState("-O2");
  const [log, setLog] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleRun() {
    setIsBusy(true);
    setLog("compiling… (the first compile downloads the ~100 MB toolchain)");
    const c = await compileCpp(src, [flag]);
    let text = `compile ${c.ok ? "OK" : "FAILED"}  ${JSON.stringify(c.timings)}  wasm=${c.wasm?.length ?? 0} bytes\n${c.diagnostics}\n`;
    if (c.ok && c.wasm) {
      const r = await runWasm(c.wasm, stdin, 5000);
      text += `run ${r.status} exit=${r.exitCode} wall=${r.wallMs}ms pages=${r.memPages} ${r.detail}\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`;
    }
    setLog(text);
    setIsBusy(false);
  }

  /** Judge the editor contents (a bare `class Solution`, no main) against the pair-sum tests via the real workers. */
  async function handleJudge() {
    setIsBusy(true);
    setLog("judging…");
    const r = await judgeProblem(PAIR_SUM, src, PAIR_SUM_TESTS, { timeLimitMs: 2000 }, {
      compile: (source) => compileCpp(source),
      run: runWasm,
    });
    const first = r.firstError;
    const rows = r.outcomes.map((o, i) => `#${i} ${o.verdict} ${o.reason ?? ""} ${o.got ?? ""}`).join("\n");
    const hint = first ? `\nfirst error L${first.line}: ${first.entry?.title ?? first.message}` : "";
    setLog(`verdict ${r.verdict} failedAt=${r.failedAt} maxMs=${r.maxMs}\n${rows}${hint}`);
    setIsBusy(false);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Judge playground</h1>
      <textarea aria-label="source" className={styles.source} value={src} onChange={(e) => setSrc(e.target.value)} />
      <textarea aria-label="stdin" className={styles.stdin} value={stdin} onChange={(e) => setStdin(e.target.value)} />
      <div className={styles.controls}>
        <label>
          flags{" "}
          <select aria-label="flags" value={flag} onChange={(e) => setFlag(e.target.value)}>
            <option>-O0</option>
            <option>-O1</option>
            <option>-O2</option>
          </select>
        </label>
        <button id="go" type="button" disabled={isBusy} onClick={handleRun}>
          {isBusy ? "Running…" : "Compile & run"}
        </button>
        <button id="judge" type="button" disabled={isBusy} onClick={handleJudge}>
          Judge pair-sum
        </button>
      </div>
      <pre id="log" className={styles.log}>
        {log}
      </pre>
    </main>
  );
}
