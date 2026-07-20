// Personal migration data for the one track that existed before multi-track
// support — Alessandro's own Game Engine & Graphics curriculum. Deliberately
// kept out of lib/templates/: it's not offered to other users creating a
// track, it's only ever used to migrate this app's original single-track
// data (pre-existing Dexie "appState" row / old-shape Drive database.json)
// into a proper track, without losing any of it.

/** Deterministic id assigned to the pre-multi-track track by the Dexie
 *  v1->v2 migration (lib/localDb.ts) and, on the Drive side, by the legacy
 *  database.json shape upgrade (lib/googleDrive.ts). Both must use this
 *  exact same constant so local and remote data resolve to the same track
 *  instead of forking into duplicates. */
export const LEGACY_TRACK_ID = "track_legacy_engine_graphics";

/** Seeded once, as the migrated track's initial roadmapContent, from the
 *  project's former engine_dev_roadmap.md (now retired as a shipped file —
 *  every track's roadmap lives in its own private, editable field instead). */
export const LEGACY_ROADMAP_CONTENT = `# 12-Month Engine Developer Curriculum & Syllabus

This document serves as a reference roadmap for all four study phases. It outlines topics, resources, milestones, and diagnostic tool integrations in chronological order.

---

## Master Curriculum Overview

| Phase | Duration | Core Goal | Primary Resources | Key Deliverable |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Months 1-3 | Language & Software Rendering | C++ Book (PPP), Lengyel Vol 1 (Mathematics), LearnOpenGL | CPU Ray Tracer |
| **Phase 2** | Months 4-7 | Hardware Rasterization | LearnOpenGL, Lengyel Vol 2 (Rendering), CMU 15-462, Calculus 1 | OpenGL Scene Viewer |
| **Phase 3** | Months 8-10 | Optimization & Architectures | CMU 15-462 (Advanced), Calculus 2 | Optimized Scene Graph Engine |
| **Phase 4** | Months 11-12| Modern GPU APIs | Vulkan Tutorial, Vector Calculus | Vulkan Mesh Renderer |

---

## Detailed Outlines by Phase

### Phase 1: Language Fundamentals & Software Rendering (Months 1–3)

#### 1. Programming (C++)
**Resource**:
- *Programming: Principles and Practice Using C++ (Stroustrup)*

**Topics**:
- Chapter 1-7: C++ syntax, types, and compiler basics
- Chapter 8-10: Pointers, references, vectors, and manual memory management
- Chapter 17-19: Templates, containers, exceptions, and resource allocation (RAII)
- Chapter 20-21: STL algorithms, lambdas, and iterator models

#### 2. Mathematics (Linear Algebra)
**Resource**:
- *Foundations of game engine development: Mathematics (Lengyel)*

**Topics**:
- Vectors: Vector spaces, dot product, cross product, projection
- Matrices: Matrix multiplication, determinants, inverse, Cramer's rule
- Transforms: Translation, scaling, rotation (axis-angle, Euler, quaternions)
- Coordinate Spaces: Local, World, View, Projection, Homogeneous coordinates

#### 3. Rendering (Software API)
**Resource**:
- *The Ray Tracer Challenge (Buck)*

**Topics**:
- Tuples, Points, Vectors, and Matrix Math verification
- Ray-Sphere intersection, shading equations, phong reflection model
- Shadows, camera transformations, and world rendering
- Reflection, refraction, and rendering visual patterns

#### 4. Algorithms & Data Structures
**Topics**:
- Cache Locality & Memory Layout (Months 1–3): Array of Structures (AoS) vs. Structure of Arrays (SoA) layout efficiency, Memory Alignment & Padding (matching compiler alignment to hardware bounds), Fixed-size pools (avoiding runtime allocation overhead).
- LeetCode Focus: **Problem-Solving Patterns**. Master the reusable templates for: Two Pointers, Sliding Window, Hash Maps, Stack/Monotonic Stack, and Advanced Binary Search. Study by technique, not by category — see the Weekly Algorithm rotation on the dashboard for specific problems.

#### 5. Diagnostic & Git Milestones
- **GitHub Launch**: Create the public repository for \`ray-tracer\`.
- **Visual README**: Embed progressive renders in the README (e.g., flat circle -> shaded sphere -> fully rendered scene with reflections).

---

### Phase 2: Hardware Rasterization & Modern OpenGL (Months 4–7)

#### 1. Programming (Engine Design)
**Resource**:
- *Game Engine Architecture (Gregory)*

**Topics**:
- Chapter 5: Engine subsystems, start/stop lifecycles
- Chapter 7: Memory management (arenas, stack allocators)
- Chapter 14: Mesh rendering pipelines, skeletal animations, shaders

#### 2. Mathematics (Calculus 1)
**Resource**:
- *Calculus: Early Transcendentals (Stewart)*

**Topics**:
- Limits, differentiation rules, chain rule
- Optimization problems (max/min boundaries)
- Applications: Finding normal vectors for complex implicit mathematical surface curves

#### 3. Rendering (Hardware API)
**Resource**:
- *LearnOpenGL (de Vries)*, *Foundations of game engine development: Rendering (Lengyel)*, & *CMU 15-462 Lectures*

**Topics**:
- Window setup (GLFW/GLAD), VBO, VAO, EBO draw calls
- Shader writing (GLSL syntax, vertex/fragment pipelines)
- Textures, coordinate transformations, projection matrices
- Lighting models: Ambient, Diffuse, Specular (Phong vs. Blinn-Phong)
- Advanced OpenGL: Framebuffers, Stencil testing, Cubemaps, Instanced drawing
- Shading equations, light sources, shadow mapping, and environment mapping (Lengyel Vol 2)

#### 4. Algorithms & Data Structures
**Topics**:
- Hierarchies & Scene Management (Months 4–7): Scene Graphs using trees or Directed Acyclic Graphs (DAGs) to propagate transformations (parent-to-child matrix multiplications).
- Traversal Loops: Iterative Depth-First Search (DFS) and Breadth-First Search (BFS) with custom Stacks to traverse the scene graph for rendering.
- LeetCode Focus: **Problem-Solving Patterns**. Master the reusable templates for: Heap/Priority Queue, Trees/DFS/BFS, Interval Problems, and DP Basics — see the Weekly Algorithm rotation on the dashboard for specific problems.

#### 5. Diagnostic & Tool Integrations
- **Dear ImGui**: Integrate ImGui panel to control:
  - Light positions, ambient/diffuse/specular colors
  - Shaders, texture switches, camera field of view (FOV)
- **RenderDoc**: Capture frames, inspect bound uniforms/VBOs, step through shader variables.
- **Debug Drawer**: Implement a utility class to draw wireframe vectors, coordinate axes, and bounding boxes in 3D.

---

### Phase 3: Spatial Architectures & Optimization (Months 8–10)

#### 1. Programming (Data Structures & Systems)
**Resource**:
- *CMU 15-462 (Advanced chapters)*

**Topics**:
- Spatial partitioning structures (Octrees, KD-Trees, BVH)
- Scene Graphs (parent-child hierarchical transformations)
- Frustum culling algorithms

#### 2. Mathematics (Calculus 2)
**Resource**:
- *Calculus: Early Transcendentals (Stewart)*

**Topics**:
- Integration techniques, numerical approximation methods
- Infinite sequences and series
- Applications: Physics integrations (Verlet/Euler integration loops)

#### 3. Rendering (Performance Pipelines)
**Topics**:
- Deferred Rendering (G-Buffers, light pass decoupling)
- Shadow Mapping (orthogonal shadows, perspective shadow maps)
- Screen Space Effects (SSAO, bloom, HDR tone mapping)

#### 4. Algorithms & Data Structures
**Topics**:
- Spatial Partitioning (Months 8–10): Bounding Volume Hierarchies (BVH) nesting primitives inside Axis-Aligned Bounding Boxes (AABBs). Quadtrees (2D) & Octrees (3D) space subdivision for view culling.
- Advanced Partitioning: kD-Trees for spatial nearest-neighbor searches (photon mapping/global illumination).
- Algorithms: Ray-AABB intersection testing, hierarchical tree traversal.
- LeetCode Focus: Implement a BVH from scratch in your Ray Tracer or Engine repository.
- Interview Patterns: **Graphs & Advanced DP**. Topological Sort, Union-Find, 2D DP (grids/strings). Continue practicing medium/hard problems across all previous patterns.

#### 5. Diagnostic & Tool Integrations
- **Profiler Integration**: Integrate Tracy Profiler (or custom timer scopes in ImGui) to track CPU/GPU frame boundaries and detect CPU-side bottleneck loops.
- **Culling Controls**: Toggle BVH/frustum culling visual overlays via ImGui to inspect culled geometry counts.

---

### Phase 4: Low-Level Graphics & Vulkan Transition (Months 11–12)

#### 1. Programming (Explicit GPU Control)
**Resource**:
- *Vulkan Tutorial (Overvoorde)*

**Topics**:
- Vulkan instances, validation layers, physical/logical devices
- Swapchains, render passes, framebuffers, command pools
- Graphics pipelines, descriptor sets, push constants
- Synchronization: Semaphores, fences, barrier queues

#### 2. Mathematics (Multivariable Calculus)
**Resource**:
- *Calculus (Stewart)*

**Topics**:
- Partial derivatives, double/triple integrals
- Gradients, curl, divergence
- Applications: Deriving the Rendering Equation, BRDF equations, Monte Carlo integration methods for physically based rendering (PBR)

#### 3. Rendering (Modern GPU Pipeline)
**Topics**:
- Physically Based Rendering (PBR) shader implementation
- Image-Based Lighting (IBL) calculations
- Multi-threaded command buffer recording

#### 4. Algorithms & Data Structures
**Topics**:
- Mesh Representation & Sorting (Months 11–12): Half-Edge data structure for mesh representations (polygon mesh adjacencies lookup for geometry processing).
- Sorting Pipelines: Radix Sort or Merge Sort for depth-sorting transparent geometry from back-to-front every frame.
- LeetCode Focus: Standard sorting algorithm mechanics and advanced Graph problems (Adjacency Lists).
- Interview Patterns: **Trie, Backtracking, Advanced Graphs**. Word Search II, Design Add/Search Words, advanced graph traversal. Full pattern review at hard difficulty.

#### 5. Diagnostic & Tool Integrations
- **RenderDoc Vulkan Validation**: Analyze memory allocations, verify descriptor layouts, debug layout transitions, and inspect device queues to resolve Vulkan pipeline layout bugs.

---

## Interview Prep: DSA Patterns

The app automatically rotates through these patterns on a 10-week cycle via the daily revision items on DSA days (Tue/Thu/Fri/Sat), shown as the Weekly Algorithm indicator on the dashboard. Each week focuses on one pattern with 4-5 recommended problems.
`;
