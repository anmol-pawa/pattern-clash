/**
 * Provisional demo problem for the P1.3 vertical slice. Original wording throughout. It is replaced by the
 * package loader in P1.4; the sample outputs are checked against a reference implementation in the tests.
 */
import type { StageProblem } from "./types";

export const PAIR_TO_TARGET: StageProblem = {
  slug: "pair-to-target",
  title: "Pair to Target",
  statement:
    "You are given an integer array nums and an integer target. Exactly two different positions hold values that add up to target. Return those two positions, smaller index first.",
  constraints: ["2 ≤ n ≤ 100,000", "−10⁹ ≤ nums[i], target ≤ 10⁹", "Exactly one valid pair exists"],
  samples: [
    { input: "nums = [3, 8, 5, 12], target = 17", output: "[2, 3]", note: "5 + 12 = 17" },
    { input: "nums = [-2, 7, 4], target = 2", output: "[0, 2]", note: "−2 + 4 = 2" },
    { input: "nums = [6, 6], target = 12", output: "[0, 1]", note: "two equal values at different positions" },
  ],
  driver: {
    kind: "function",
    name: "pairToTarget",
    returns: "vector<int>",
    params: [
      { type: "vector<int>&", name: "nums" },
      { type: "int", name: "target" },
    ],
  },
  pattern: "hashing",
  deck: [
    { id: "two-pointers", cost: 3 },
    { id: "sliding-window", cost: 3 },
    { id: "prefix-sum", cost: 2 },
    { id: "hashing", cost: 3 },
    { id: "binary-search", cost: 2 },
    { id: "monotonic-stack", cost: 4 },
    { id: "heap-top-k", cost: 4 },
    { id: "greedy", cost: 2 },
  ],
  threats: [
    { id: "dupes", kind: "twin", lane: "right", spawnAtSec: 45, counter: "check-before-insert" },
    { id: "scale", kind: "juggernaut", lane: "left", spawnAtSec: 100, counter: "test:perf" },
  ],
  brute: {
    prompt: "The obvious approach checks every pair of positions. How does it grow?",
    options: ["O(n)", "O(n log n)", "O(n²)"],
    answer: 2,
    note: "Every pair is n(n−1)/2 checks: at n = 100,000 that is about 5 × 10⁹, far beyond a one-second budget.",
  },
  components: [
    {
      id: "declare-seen",
      title: "Declare state",
      lines: ["unordered_map<int, int> seen;  // value -> index"],
      edge: false,
      why: {
        prompt: "Why key the map by value rather than by index?",
        options: [
          "We look up the value we still need, so it must be the key",
          "Maps keep their keys sorted",
          "Indices might repeat",
        ],
        answer: 0,
      },
      mistake: "Keying by index forces a scan to find the needed value, which is the O(n²) brute force again.",
    },
    {
      id: "loop-need",
      title: "Loop and complement",
      lines: ["for (int i = 0; i < (int)nums.size(); ++i) {", "    int need = target - nums[i];"],
      edge: false,
      why: {
        prompt: "What does need represent?",
        options: ["The value that would complete a pair with nums[i]", "The largest value seen so far", "The index of the answer"],
        answer: 0,
      },
      mistake: "Computing nums[i] − target flips the sign and never matches.",
    },
    {
      id: "check-before-insert",
      title: "Check, then remember",
      lines: [
        "    auto it = seen.find(need);",
        "    if (it != seen.end()) return {it->second, i};",
        "    seen[nums[i]] = i;",
      ],
      edge: true,
      why: {
        prompt: "Why look up need before inserting nums[i]?",
        options: [
          "So an element never pairs with itself, while equal values at two positions still match",
          "Lookups are faster than inserts",
          "To keep the map sorted",
        ],
        answer: 0,
      },
      mistake: "Inserting first lets target = 2 × nums[i] pair an element with itself.",
    },
    {
      id: "close-loop",
      title: "Close and fall back",
      lines: ["}", "return {};"],
      edge: false,
      why: {
        prompt: "When is the final return {} reached?",
        options: ["Never for valid input, but the function must still return on every path", "When the array is empty", "When the pair is found"],
        answer: 0,
      },
      mistake: "Leaving out the final return is undefined behaviour in C++ even if valid input never reaches it.",
    },
  ],
  complexity: {
    time: { prompt: "Time complexity", options: ["O(n²)", "O(n log n)", "O(n)", "O(1)"], answer: 2 },
    space: { prompt: "Space complexity", options: ["O(1)", "O(n)", "O(n²)"], answer: 1 },
    derivation: {
      prompt: "Why?",
      options: [
        "One pass; each step does one average O(1) lookup and one insert, and the map holds at most n entries",
        "The map keeps its keys sorted, so lookups are logarithmic",
        "Two nested loops over the array",
      ],
      answer: 0,
    },
  },
  explanation:
    "Walk the array once. For each value, the partner it needs is target minus that value. Keep a hash map from values already seen to their positions: if the partner is already there, those two positions are the answer. Checking before inserting stops an element pairing with itself while still matching two equal values. That is one pass with O(1) average work per element, so O(n) time, and the map holds at most n entries, so O(n) space.",
  followups: [
    {
      prompt: "The array arrives sorted and you may use only O(1) extra space. What changes?",
      options: [
        "Two pointers from both ends: move the left one up when the sum is too small, the right one down when too large",
        "Keep the hash map; sorting does not help",
        "Binary search for each element's partner using a hash set",
      ],
      answer: 0,
      note: "Sorted order lets two pointers discard one candidate per step: O(n) time, O(1) space.",
    },
    {
      prompt: "Now return every pair of values that reaches target, each pair once. What must change?",
      options: [
        "Keep scanning after a match and track which values were already paired so no pair repeats",
        "Nothing: the first match is enough",
        "Switch to dynamic programming",
      ],
      answer: 0,
      note: "The single-answer early return becomes collection, and de-duplication becomes part of the state.",
    },
  ],
};
