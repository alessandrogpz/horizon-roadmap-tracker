# Comprehensive DSA & Algorithm Patterns Study Guide

When preparing for technical interviews at top tech companies, knowing basic data structures (Arrays, Linked Lists, Trees) and named algorithms (MergeSort, Dijkstra) is only half the battle. The secret to solving Medium and Hard problems on platforms like LeetCode is recognizing and applying **Problem-Solving Paradigms** (Patterns). 

This guide focuses on the high-ROI patterns that frequently appear in interviews, organized by priority.

> **Part of the 12-Month Engine Developer Curriculum.** See the [Master Curriculum](/roadmap) for the full roadmap. The app automatically rotates through these patterns weekly via your daily revision items.

---

## 1. Hash Map Patterns
**Why it matters:** Extremely high frequency. Often used to optimize O(N^2) time complexity down to O(N) by trading space for time.

### Key Techniques:
- **Frequency Counting:** Storing the count of occurrences of characters or numbers.
- **Two-Sum Pattern:** Storing complements (target - current_value) to find pairs in O(1) time.
- **Grouping:** Grouping items by a specific characteristic (e.g., anagrams, grouped by sorted string).

### Recommended Practice:
- Two Sum
- Valid Anagram
- Group Anagrams
- Top K Frequent Elements
- Longest Consecutive Sequence

---

## 2. Two Pointers
**Why it matters:** The #1 array/string technique. Crucial for optimizing space complexity to O(1) in sorted arrays or linked lists.

### Key Techniques:
- **Opposite Ends:** One pointer at the start, one at the end, moving towards the center (e.g., reversing strings, finding pairs in sorted arrays).
- **Fast and Slow Pointers (Tortoise and Hare):** Used for cycle detection in Linked Lists or finding the middle.
- **Same Direction:** Processing arrays in place without extra memory (e.g., removing duplicates).

### Recommended Practice:
- Valid Palindrome
- Two Sum II - Input Array Is Sorted
- 3Sum
- Container With Most Water
- Trapping Rain Water (Hard, but essential)

---

## 3. Sliding Window
**Why it matters:** Solves ~30% of medium string/array problems. Used when finding the longest/shortest **contiguous** subarray or substring that satisfies a certain condition.

### Key Techniques:
- **Fixed Size Window:** The window size remains constant as it slides across the array.
- **Dynamic Size Window:** The window expands until a condition is violated, then contracts from the left until the condition is met again.

### Recommended Practice:
- Best Time to Buy and Sell Stock
- Longest Substring Without Repeating Characters
- Longest Repeating Character Replacement
- Minimum Window Substring (Hard)

---

## 4. Binary Search (On the Answer Space)
**Why it matters:** High frequency. It's not just about finding an element in a sorted array; it's about finding an optimal solution within a monotonic range of possible answers.

### Key Techniques:
- **Standard Binary Search:** Finding a target.
- **Binary Search on Answer:** If you can easily verify if a given value `X` is valid, and validity is monotonic (e.g., if `X` is valid, all values `> X` are valid), you can binary search for the minimum/maximum valid `X`.

### Recommended Practice:
- Binary Search
- Search a 2D Matrix
- Find Minimum in Rotated Sorted Array
- Search in Rotated Sorted Array
- Koko Eating Bananas (Classic Binary Search on Answer)

---

## 5. Stack / Monotonic Stack
**Why it matters:** High frequency. Stacks are great for matching problems (parentheses) or traversing backwards. Monotonic Stacks are a specific pattern used to find the "next greater/smaller element".

### Key Techniques:
- **LIFO Processing:** Validating matching pairs or evaluating expressions.
- **Monotonic Increasing/Decreasing Stack:** Maintaining elements in a strictly increasing or decreasing order to efficiently find the next larger/smaller element in O(N) time.

### Recommended Practice:
- Valid Parentheses
- Min Stack
- Evaluate Reverse Polish Notation
- Daily Temperatures (Monotonic Stack)
- Largest Rectangle in Histogram (Hard)

---

## 6. Heap / Priority Queue Patterns
**Why it matters:** Very high frequency. Used anytime a problem asks for the "Top K", "Kth largest/smallest", or requires repeatedly finding the minimum/maximum element dynamically.

### Key Techniques:
- **Top K Elements:** Maintain a Min-Heap of size K. When the heap exceeds K, pop the smallest. You are left with the Top K largest elements.
- **Merge K Sorted:** Use a Min-Heap to keep track of the smallest current element across K lists.
- **Two Heaps (Median Stream):** Maintain a Max-Heap for the lower half and a Min-Heap for the upper half.

### Recommended Practice:
- Kth Largest Element in a Stream
- Last Stone Weight
- K Closest Points to Origin
- Find Median from Data Stream (Hard - Two Heaps)
- Merge k Sorted Lists (Hard)

---

## 7. Trees / DFS / BFS
**Why it matters:** Fundamental for almost all interviews. You need to be incredibly comfortable with tree traversals.

### Key Techniques:
- **Depth-First Search (DFS):** Recursion. Good for exploring all paths, checking properties from root to leaf.
- **Breadth-First Search (BFS):** Using a Queue. Essential for finding the shortest path in unweighted graphs or doing level-order traversal.

### Recommended Practice:
- Invert Binary Tree
- Maximum Depth of Binary Tree
- Diameter of Binary Tree
- Balanced Binary Tree
- Binary Tree Level Order Traversal (BFS)
- Validate Binary Search Tree
- Lowest Common Ancestor of a Binary Search Tree

---

## 8. Interval Problems
**Why it matters:** Very high frequency at Amazon and other FAANG companies. Involves dealing with overlapping ranges.

### Key Techniques:
- **Sorting by Start Time:** The first step in almost every interval problem.
- **Overlapping Condition:** Two intervals `[a, b]` and `[c, d]` overlap if `c <= b`.

### Recommended Practice:
- Merge Intervals
- Insert Interval
- Non-overlapping Intervals
- Meeting Rooms I & II (Premium, but concepts are essential)

---

## 9. Dynamic Programming (DP) Basics
**Why it matters:** Often feared, but follows distinct patterns. Do not jump straight to hard DP problems; master the progression.

### The Progression Path:
1. **1D DP (Fibonacci Sequence style):**
   - Climbing Stairs
   - Min Cost Climbing Stairs
   - House Robber
2. **Combinatorics / Knapsack (Choosing combinations):**
   - Coin Change
   - Word Break
3. **Subsequence DP:**
   - Longest Increasing Subsequence (LIS)
4. **2D DP (Grids/Strings):**
   - Unique Paths
   - Longest Common Subsequence

---

## 10. Graphs: Advanced Traversal & Union-Find
**Why it matters:** Medium frequency, but required for specific problem types like connectivity or topological sorting.

### Key Techniques:
- **Matrix as Graph (Islands):** Using DFS/BFS on a 2D grid.
- **Topological Sort:** For dependency resolution (e.g., Course Schedule).
- **Union-Find (Disjoint Set):** Extremely efficient for grouping connected components or detecting cycles in undirected graphs.

### Recommended Practice:
- Number of Islands
- Max Area of Island
- Clone Graph
- Course Schedule (Topological Sort)
- Redundant Connection (Union-Find)

---

## 11. Trie (Prefix Tree)
**Why it matters:** Medium frequency. The ultimate data structure for string prefix matching, autocomplete, and word search optimizations.

### Recommended Practice:
- Implement Trie (Prefix Tree)
- Design Add and Search Words Data Structure
- Word Search II (Hard - DFS + Trie)

---

## Study Strategy Recommendation

1. **Don't do random problems.** Pick one pattern (e.g., Sliding Window) and do 5-7 problems *only* using that pattern until it clicks.
2. **Quality over Quantity.** If you are stuck for more than 30-40 minutes on a Medium, look at the solution. Understand *why* they used a specific pattern.
3. **Spaced Repetition.** Re-do problems you struggled with a week later from scratch.
4. **Code Structure.** Focus on clean code. For example, in Sliding Window problems, always use a standard `while(right < n)` template.
