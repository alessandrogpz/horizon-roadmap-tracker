import type { FocusType, WeekDay } from "./types";

export const DEFAULT_WEEK_SCHEDULE: WeekDay[] = [
  { name: "Mon", type: "math", label: "Math" },
  { name: "Tue", type: "dsapattern", label: "DSA Pattern" },
  { name: "Wed", type: "math", label: "Math" },
  { name: "Thu", type: "dsapattern", label: "DSA Pattern" },
  { name: "Fri", type: "math", label: "Math" },
  { name: "Sat", type: "implementation", label: "DS Implementation" },
  { name: "Sun", type: "free", label: "Free" },
];

export const DEFAULT_FOCUS_TYPES: Record<string, FocusType> = {
  math: { label: "Math", color: "#a78bfa" },
  dsapattern: { label: "DSA Pattern", color: "#34d399" },
  dsapractice: { label: "DSA Practice", color: "#22d3ee" },
  implementation: { label: "DS Implementation", color: "#fbbf24" },
  free: { label: "Free", color: "#a1a1aa" },
};

// 10-week DSA pattern rotation (matches DSA_Study_Guide.md ordering)
export const DSA_PATTERN_WEEKS = [
  { pattern: "Hash Map Patterns", problems: "Two Sum, Group Anagrams, Top K Frequent Elements, Longest Consecutive Sequence" },
  { pattern: "Two Pointers", problems: "Valid Palindrome, Two Sum II, 3Sum, Container With Most Water, Trapping Rain Water" },
  { pattern: "Sliding Window", problems: "Best Time to Buy/Sell Stock, Longest Substring Without Repeating, Longest Repeating Character Replacement, Minimum Window Substring" },
  { pattern: "Binary Search (Advanced)", problems: "Search a 2D Matrix, Find Min in Rotated Array, Search in Rotated Array, Koko Eating Bananas" },
  { pattern: "Stack & Monotonic Stack", problems: "Valid Parentheses, Min Stack, Daily Temperatures, Largest Rectangle in Histogram" },
  { pattern: "Heap / Priority Queue", problems: "Kth Largest Element, K Closest Points, Find Median from Data Stream, Merge k Sorted Lists" },
  { pattern: "Trees / DFS / BFS", problems: "Invert Binary Tree, Max Depth, Validate BST, Level Order Traversal, Lowest Common Ancestor" },
  { pattern: "Interval Problems", problems: "Merge Intervals, Insert Interval, Non-overlapping Intervals, Meeting Rooms" },
  { pattern: "DP Basics", problems: "Climbing Stairs, House Robber, Coin Change, Longest Increasing Subsequence, Unique Paths" },
  { pattern: "Graphs & Union-Find", problems: "Number of Islands, Clone Graph, Course Schedule, Redundant Connection" },
];

/** Index into DSA_PATTERN_WEEKS for a given curriculum week. */
export function dsaPatternIndex(weekNum: number, dsaStartWeek: number = 1): number {
  const len = DSA_PATTERN_WEEKS.length;
  return (((weekNum - dsaStartWeek) % len) + len) % len;
}
