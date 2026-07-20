import type { Material, Phase, PortfolioProject } from "../types";
import { DEFAULT_WEEK_SCHEDULE, DEFAULT_FOCUS_TYPES, DSA_PATTERN_WEEKS } from "../constants";
import type { TrackTemplate } from "./types";

/**
 * Deterministic id assigned to the one pre-existing track created by the
 * Dexie v1→v2 migration (lib/localDb.ts) and, on the Drive side, by the
 * legacy database.json shape upgrade (lib/googleDrive.ts). Both must use
 * this exact same constant so local and remote data resolve to the same
 * track instead of forking into duplicates.
 */
export const LEGACY_TRACK_ID = "track_legacy_engine_graphics";

// Real, hand-tuned phase data lifted from the live curriculum (data/database.json),
// not a re-parse of engine_dev_roadmap.md — already correct, already in daily use.
const buildPhases = (): Phase[] => [
  {
    id: 1,
    title: "Phase 1: Months 1-3",
    description: "Language Fundamentals & Software Rendering",
    recommendedByDay: 90,
    tasks: [
      { id: "t3", title: "C++ Book (PPP)", completed: false },
      { id: "t4", title: "Ray Tracer Challenge", completed: false },
      { id: "t5", title: "Linear Algebra", completed: false },
      { id: "t6", title: "LearnOpenGL", completed: false },
    ],
    detailedInfo: {
      focus: [
        { item: "Foundations of game engine development: Mathematics", desc: "Study vector spaces, matrix multiplication, and baseline linear algebra." },
        { item: "Programming: Principles and Practice Using C++", desc: "Master pointers, references, manual memory allocation, and STL containers." },
        { item: "Ray Tracer Challenge", desc: "Implement basic canvas, ray casting, shading, and sphere intersections." },
        { item: "LearnOpenGL", desc: "Start with window setups, coordinate systems, and basic rendering shaders." },
      ],
      deliverable: [
        { item: "CPU Software Ray Tracer", desc: "A standalone, CPU-bound C++ rendering application capable of shading spheres, shadows, and reflections." },
      ],
      math: [
        { item: "Linear Algebra Foundations", desc: "Vector/matrix math and coordinate spaces (local, world, view, projection)." },
      ],
      algoDS: [
        { item: "Cache Locality & Memory Layout", desc: "Array of Structures (AoS) vs. Structure of Arrays (SoA), Memory Alignment & Padding (alignas), and Fixed-size pools to avoid heap overhead." },
        { item: "LeetCode Focus", desc: "Master the core problem-solving pattern templates: Two Pointers, Sliding Window, Hash Maps, Stack/Monotonic Stack, and Advanced Binary Search." },
      ],
    },
  },
  {
    id: 2,
    title: "Phase 2: Months 4-7",
    description: "Hardware Rasterization & Modern OpenGL",
    recommendedByDay: 210,
    tasks: [
      { id: "t2_1", title: "LearnOpenGL", completed: false },
      { id: "t2_2", title: "Calculus 1 (Stewart)", completed: false },
      { id: "t2_3", title: "OpenGL Mini-Engine", completed: false },
      { id: "t2_lengyel2", title: "Foundations of game engine development: Rendering", completed: false },
      { id: "t2_imgui", title: "Integrate Dear ImGui control panel", completed: false },
      { id: "t2_rdoc", title: "Learn basic RenderDoc shader & texture frame debugging", completed: false },
      { id: "t2_draw", title: "Implement debug line/wireframe drawer", completed: false },
    ],
    detailedInfo: {
      focus: [
        { item: "LearnOpenGL", desc: "Study Core Profile features, texturing, lighting equations, and shader languages (GLSL)." },
        { item: "CMU 15-462 Computer Graphics", desc: "Leverage lectures to match graphics theories directly with active code." },
        { item: "Stewart's Calculus 1", desc: "Go over differentiation rules and differentiation applications." },
        { item: "Foundations of game engine development: Rendering", desc: "Study lighting models, shading math, shadow algorithms, and environment maps." },
        { item: "Dear ImGui Integration", desc: "Build real-time interactive parameters, light controllers, and camera toggles." },
        { item: "RenderDoc Frame Capture", desc: "Analyze bound pipelines, uniform states, and step through shader variables." },
        { item: "3D Debug Line Drawing", desc: "Draw line arrays, coordinate axes, and bounding boxes in 3D world space." },
      ],
      deliverable: [
        { item: "OpenGL Scene Viewer", desc: "A 3D mesh renderer loading files via Assimp, custom scene graphs, real-time lighting (Blinn-Phong), and shadow mapping." },
      ],
      math: [
        { item: "Calculus 1 (Limits & Derivatives)", desc: "Calculate change over time, surface normals of complex geometry, and ray differentials for texture filtering." },
      ],
      algoDS: [
        { item: "Hierarchies & Scene Management", desc: "Scene Graphs using trees or Directed Acyclic Graphs (DAGs) to propagate spatial transformations parent-to-child." },
        { item: "Traversal Loops", desc: "Iterative Depth-First Search (DFS) and Breadth-First Search (BFS) using custom Stacks to traverse scene graphs." },
        { item: "LeetCode Focus", desc: "Master the core problem-solving pattern templates: Heap/Priority Queue, Trees/DFS/BFS, Interval Problems, and DP Basics." },
      ],
    },
  },
  {
    id: 3,
    title: "Phase 3: Months 8-10",
    description: "Spatial Architectures & Optimization",
    recommendedByDay: 300,
    tasks: [
      { id: "t3_1", title: "OpenGL Mini-Engine", completed: false },
      { id: "t3_2", title: "Calculus 2 (Stewart)", completed: false },
      { id: "t3_prof", title: "Integrate real-time frame/CPU profiling", completed: false },
    ],
    detailedInfo: {
      focus: [
        { item: "CMU 15-462 (Advanced)", desc: "Focus on spatial partitioning data structures and geometry processing chapters." },
        { item: "Stewart's Calculus 2", desc: "Review integrations and partial derivatives chapters." },
        { item: "Performance Profiling (Tracy)", desc: "Integrate Tracy Profiler to identify CPU/GPU frame boundary bottlenecks." },
      ],
      deliverable: [
        { item: "Optimized Mini-Engine", desc: "Integrate View Frustum Culling, spatial partitioning (Octree/BVH), and post-processing pipelines (Bloom/HDR)." },
      ],
      math: [
        { item: "Calculus 2 (Integration & Partial Derivatives)", desc: "Numerical integration for physics loops. Partial derivatives for texture coordinate (u, v) gradients across triangles." },
      ],
      algoDS: [
        { item: "Spatial Partitioning", desc: "Bounding Volume Hierarchies (BVH) nesting shapes in Axis-Aligned Bounding Boxes (AABBs), Quadtrees (2D) & Octrees (3D) for frustum culling, and kD-Trees." },
        { item: "Algorithms", desc: "Ray-AABB intersection testing and hierarchical tree traversal." },
        { item: "LeetCode Focus", desc: "Implement a custom BVH from scratch in your Ray Tracer or Engine repository." },
        { item: "Interview Patterns", desc: "Graphs & Advanced DP: Topological Sort, Union-Find, 2D DP (grids/strings). Continue practicing medium/hard problems across all previous patterns." },
      ],
    },
  },
  {
    id: 4,
    title: "Phase 4: Months 11-12",
    description: "Low-Level Graphics (Vulkan Transition)",
    recommendedByDay: 365,
    tasks: [
      { id: "t4_1", title: "Vulkan Tutorial", completed: false },
      { id: "t4_2", title: "Vector & Multivariable Calculus (Stewart)", completed: false },
      { id: "t4_3", title: "Vulkan Renderer", completed: false },
      { id: "t4_rdoc", title: "Diagnose Vulkan device queues & pipeline states with RenderDoc", completed: false },
    ],
    detailedInfo: {
      focus: [
        { item: "Official Vulkan Tutorial", desc: "Work through swapchain setups, command buffers, memory allocation, and custom render passes." },
        { item: "Multivariable & Vector Calculus", desc: "Complete Stewart's vector calculus and numerical methods chapters." },
        { item: "Vulkan RenderDoc Diagnostics", desc: "Verify device queues, descriptor layouts, and memory barriers under Vulkan." },
      ],
      deliverable: [
        { item: "Vulkan Mesh Renderer", desc: "A basic Vulkan renderer setting up explicit pipelines and device buffers to draw textured meshes." },
      ],
      math: [
        { item: "Vector & Multivariable Calculus", desc: "Gradients for Signed Distance Fields (SDFs). Double and line integrals to solve the PBR Rendering Equation. Monte Carlo numerical integrations." },
      ],
      algoDS: [
        { item: "Mesh Representation & Sorting", desc: "Half-Edge data structure for mesh representations (polygon mesh adjacencies lookup for geometry processing)." },
        { item: "Sorting Pipelines", desc: "Radix Sort or Merge Sort for depth-sorting transparent geometry from back-to-front every frame." },
        { item: "LeetCode Focus", desc: "Standard sorting algorithm mechanics and advanced Graph problems (Adjacency Lists)." },
        { item: "Interview Patterns", desc: "Trie, Backtracking, Advanced Graphs: Word Search II, Design Add/Search Words, advanced graph traversal. Full pattern review at hard difficulty." },
      ],
    },
  },
];

const defaultMaterials: Omit<Material, "id">[] = [
  { title: "Foundations of Game Engine Development, Vol 1: Mathematics", category: "Mathematics", type: "Book", status: "Not Started", currentPage: 0, totalPages: 183, currentSubject: "", link: "" },
  { title: "Programming: Principles and Practice Using C++", category: "Programming Languages", type: "Book", status: "Not Started", currentPage: 0, totalPages: 639, currentSubject: "", link: "" },
  { title: "Ray Tracer Challenge", category: "Computer Graphics", type: "Book", status: "Not Started", currentPage: 0, totalPages: 264, currentSubject: "", link: "" },
  { title: "LearnOpenGL", category: "Computer Graphics", type: "Website", status: "Not Started", currentPage: 0, totalPages: 50, currentSubject: "", link: "https://learnopengl.com" },
];

const defaultPortfolio: Omit<PortfolioProject, "id">[] = [
  { title: "CPU Ray Tracer", completed: false },
  { title: "OpenGL Mini-Engine", completed: false },
  { title: "Vulkan Mesh Renderer", completed: false },
];

export const engineGraphicsTemplate: TrackTemplate = {
  id: "engine-graphics",
  label: "Game Engine & Graphics",
  description: "A year-long curriculum toward building your own game engine — from CPU ray tracing through modern OpenGL to Vulkan, interleaved with math and DSA practice.",
  defaultColor: "#0ea5e9",
  defaultDurationDays: 365,
  buildPhases,
  defaultWeekSchedule: DEFAULT_WEEK_SCHEDULE,
  defaultFocusTypes: DEFAULT_FOCUS_TYPES,
  defaultMaterials,
  defaultPortfolio,
  rotationConfig: {
    weeks: DSA_PATTERN_WEEKS,
    startWeek: 1,
    appliesToScheduleType: "math",
  },
};
