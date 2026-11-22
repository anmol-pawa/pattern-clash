/** Display names for pattern cards (GDD §2). Card ids are stable keys; names are what the player reads. */
export const PATTERN_NAMES: Record<string, string> = {
  "two-pointers": "Two Pointers",
  "sliding-window": "Sliding Window",
  "prefix-sum": "Prefix Sum",
  hashing: "Hashing",
  "binary-search": "Binary Search",
  "bs-on-answer": "BS on Answer",
  "monotonic-stack": "Monotonic Stack",
  "heap-top-k": "Heap / Top-K",
  bfs: "BFS",
  dfs: "DFS",
  "topo-sort": "Topo Sort",
  dijkstra: "Dijkstra",
  dsu: "DSU",
  backtracking: "Backtracking",
  "dp-1d": "1D DP",
  "dp-2d": "2D DP",
  interval: "Interval",
  greedy: "Greedy",
  bitmask: "Bitmask",
  trie: "Trie",
  "fast-slow": "Fast / Slow Pointers",
  "recursion-tree": "Recursion Tree",
};

export function patternName(id: string): string {
  return PATTERN_NAMES[id] ?? id;
}
