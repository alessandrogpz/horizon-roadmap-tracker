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

/** Seeded once, as the migrated track's initial roadmapContent. The
 *  rebalanced 13-month plan: Phase 2 slimmed to "real-time rendering,
 *  end to end", engine architecture + the asset pipeline moved into the
 *  now-longer Phase 3, Phase 4 reduced to Vulkan alone, and one
 *  consolidation week closing every phase. Kept in step with each phase's
 *  tasks/detailedInfo in data/database.json — the timeline is a summary of
 *  this document, never a second plan. */
export const LEGACY_ROADMAP_CONTENT = `# 13-Month Engine Developer Curriculum & Syllabus

This document is the reference roadmap for all four study phases. It outlines topics, resources, milestones, and diagnostic tool integrations in chronological order. Every phase heading, deliverable, and task here has a matching entry in the **Roadmap Timeline** on the dashboard — the two are kept in step deliberately, so the timeline is a summary of this document and never a second, drifting plan.

**Track start:** 2026-06-05. All day numbers below are counted from that date, and match each phase's recommended-by-day threshold in the timeline.

---

## Master Curriculum Overview

| Phase | Months | Days | Ends | Core Goal | Primary Resources | Key Deliverable |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | 1–3 | 1–92 | 2026-09-05 | Language Fundamentals & Software Rendering | C++ (PPP), Lengyel Vol 1, Ray Tracer Challenge | CPU Ray Tracer |
| **Phase 2** | 4–6 | 93–186 | 2026-12-08 | Real-Time Rendering, End to End | LearnOpenGL, Calculus 1 | OpenGL Scene Viewer |
| **Phase 3** | 7–11 | 187–334 | 2027-05-05 | Engine Architecture & Optimization | Gregory, Lengyel Vol 2, CMU 15-462, Calculus 2 | Optimized Engine + Asset Pipeline |
| **Phase 4** | 12–13 | 335–396 | 2027-07-06 | Explicit GPU Control | Vulkan Tutorial, Multivariable Calculus | Vulkan Mesh Renderer |

---

## How This Plan Is Paced

Read this before the phase outlines — it explains why the phases are the lengths they are.

**Consolidation weeks.** Every phase ends with one week in which no new material is started. That week is for finishing the chapter you are mid-way through, cleaning up the deliverable, writing the README, and committing. It is the plan's shock absorber: when a phase runs late, the consolidation week absorbs it instead of the overrun silently pushing Phase 4 off the end of the calendar.

**Carry-over is expected, not a failure.** Books are allowed to cross a phase boundary. A phase ends when its **deliverable** is done, not when every page is read. The one hard rule is that a book may only carry over once — if it is still open two phases later, cut its remaining scope rather than dragging it forward again.

**Load is front-loaded away from Phase 2.** Phase 2 was previously carrying four books, three tools, a database subsystem, and the scene viewer in four months, while Phase 3 carried three tasks in three months. Engine architecture (Gregory), the Lengyel Vol 2 deepening pass, and all asset-database work have moved into Phase 3, which is now the long phase. Phase 2 does one thing: get a real-time renderer working end to end.

**Sequencing over parallelism.** Where a tutorial resource and a reference resource cover the same ground, the tutorial comes first and the reference becomes a second, deeper pass over code that already exists. This is why LearnOpenGL (Phase 2) and Lengyel Vol 2 (Phase 3) are no longer in the same phase — running them in parallel means neither one lands.

---

## Detailed Outlines by Phase

### Phase 1: Language Fundamentals & Software Rendering (Months 1–3)

**Days 1–92, ending 2026-09-05. Deliverable: CPU Ray Tracer.**

#### 1. Programming (C++)
**Resource**: *Programming: Principles and Practice Using C++ (Stroustrup)*

**Topics**:
- Chapter 1-7: C++ syntax, types, and compiler basics
- Chapter 8-10: Pointers, references, vectors, and manual memory management
- Chapter 17-19: Templates, containers, exceptions, and resource allocation (RAII)
- Chapter 20-21: STL algorithms, lambdas, and iterator models

**Carry-over**: chapters 17-21 are expected to land in Phase 2. Prioritise 8-10 inside this phase — the ray tracer depends on them and the later chapters do not.

#### 2. Mathematics (Linear Algebra)
**Resource**: *Foundations of Game Engine Development, Vol 1: Mathematics (Lengyel)*

**Topics**:
- Vectors: vector spaces, dot product, cross product, projection
- Matrices: matrix multiplication, determinants, inverse, Cramer's rule
- Transforms: translation, scaling, rotation (axis-angle, Euler, quaternions)
- Coordinate spaces: local, world, view, projection, homogeneous coordinates

#### 3. Rendering (Software API)
**Resource**: *The Ray Tracer Challenge (Buck)*

**Topics**:
- Tuples, points, vectors, and matrix math verification
- Ray-sphere intersection, shading equations, Phong reflection model
- Shadows, camera transformations, and world rendering
- Reflection, refraction, and rendering visual patterns

#### 4. Algorithms & Data Structures
**Topics**:
- Cache locality and memory layout: Array of Structures (AoS) vs. Structure of Arrays (SoA), memory alignment and padding, fixed-size pools to avoid runtime allocation overhead
- LeetCode focus — **problem-solving patterns**: Two Pointers, Sliding Window, Hash Maps, Stack/Monotonic Stack, Advanced Binary Search. Study by technique, not by category; see the Weekly Algorithm rotation on the dashboard for specific problems.

#### 5. Diagnostic & Portfolio Milestones
- **GitHub launch**: public repository for the ray tracer.
- **Visual README**: embed progressive renders (flat circle, then shaded sphere, then a full scene with reflections). This is the phase's portfolio artifact, not an afterthought.

#### 6. Consolidation Week (week 13)
- No new chapters. Finish the ray tracer's final scene, write the README, tag a release.
- Honest audit: which of PPP and LearnOpenGL are carrying into Phase 2, and how far.

---

### Phase 2: Real-Time Rendering, End to End (Months 4–6)

**Days 93–186, ending 2026-12-08. Deliverable: OpenGL Scene Viewer.**

This phase has one job: move from software rendering to a real-time GPU renderer you can fly a camera around. Engine architecture, spatial optimization, and asset databases are deliberately *not* here — they are Phase 3.

#### 1. Programming (C++, finishing)
**Resource**: *Programming: Principles and Practice Using C++ (Stroustrup)* — carry-over

**Topics**:
- Chapter 17-19: templates, containers, exceptions, RAII
- Chapter 20-21: STL algorithms, lambdas, iterator models
- Applied immediately: RAII wrappers for OpenGL handles (buffers, textures, shader programs) so GPU resources free themselves.

#### 2. Mathematics (Calculus 1)
**Resource**: *Calculus: Early Transcendentals (Stewart)*

**Topics**:
- Limits, differentiation rules, chain rule
- Optimization problems (max/min boundaries)
- **Direct application**: the tangent/bitangent (TBN) basis for normal mapping is derived from partial derivatives of position with respect to UV. Do that derivation by hand before using LearnOpenGL's normal mapping code.
- Secondary application: fitting a shadow-map frustum tightly to a scene is a constrained min/max problem.

#### 3. Rendering (Hardware API)
**Resource**: *LearnOpenGL (de Vries)*

**Topics**:
- Window setup (GLFW/GLAD), VBO, VAO, EBO draw calls
- Shader writing (GLSL syntax, vertex/fragment pipelines)
- Textures, coordinate transformations, projection matrices
- Lighting models: ambient, diffuse, specular (Phong vs. Blinn-Phong)
- Model loading with Assimp; a free-fly camera
- Advanced OpenGL: framebuffers, stencil testing, cubemaps, instanced drawing
- Advanced lighting: shadow mapping, normal mapping

#### 4. Algorithms & Data Structures
**Topics**:
- Scene graph: a tree of nodes propagating transforms parent-to-child by matrix multiplication. Built here because the scene viewer needs it; its promotion into a real engine subsystem is Phase 3.
- Traversal: iterative depth-first and breadth-first traversal using an explicit stack rather than recursion, so deep hierarchies cannot blow the call stack mid-frame.
- LeetCode focus — **problem-solving patterns**: Heap/Priority Queue, Trees/DFS/BFS, Interval Problems, DP Basics. The tree patterns and the scene graph traversal are the same skill; do them in the same weeks.

#### 5. Diagnostic & Tool Integrations
- **Dear ImGui**: a control panel for light positions, ambient/diffuse/specular colours, shader and texture switching, and camera field of view.
- **RenderDoc**: capture a frame, inspect bound uniforms and VBOs, step through shader variables. Target skill: given a black screen, find the cause from the capture alone.
- **Debug drawer**: a utility class drawing wireframe vectors, coordinate axes, and bounding boxes in 3D world space. You will rely on this constantly in Phase 3.

#### 6. Consolidation Week & Portfolio Milestone
- No new chapters. Polish the scene viewer, fix the camera, make it run from a clean clone.
- **Portfolio artifact**: a short screen-captured demo video plus stills in the README — a loaded model, lit and shadowed, with the ImGui panel visible. Link it from the repository's description.

---

### Phase 3: Engine Architecture & Optimization (Months 7–11)

**Days 187–334, ending 2027-05-05. Deliverable: Optimized Engine + Asset Pipeline.**

The long phase, and the one where the artifact stops being a renderer and starts being an engine. Split into two halves.

#### Half A — Architecture (Months 7–9)

#### 1. Programming (Engine Design)
**Resource**: *Game Engine Architecture (Gregory)*

**Topics**:
- Chapter 5: engine subsystems, start/stop lifecycles, and the main loop
- Chapter 7: memory management — arena, stack, and pool allocators
- Chapter 14: mesh rendering pipelines and the render subsystem

**Required artifact** (this is what stops Gregory from being passive reading): replace raw \`new\`/\`delete\` in the mesh and texture loading paths with a custom arena allocator plus a pool allocator for fixed-size objects. Measure load time and peak allocation count before and after, and record both numbers. If the chapter produces no measurement, it has not been done.

#### 2. Rendering (Deepening Pass)
**Resource**: *Foundations of Game Engine Development, Vol 2: Rendering (Lengyel)* and *CMU 15-462 (advanced lectures)*

Read Vol 2 **only** for the chapters whose techniques already exist in your renderer. It is a derivation reference, not a tutorial — the value is in understanding why the code you shipped in Phase 2 works.

**Topics**:
- Shading equations and light source models (behind Blinn-Phong)
- Shadow algorithms (behind your Phase 2 shadow maps)
- Environment mapping and reflections
- CMU 15-462: geometry processing and spatial data structure lectures

#### 3. Asset Pipeline (Relational vs. Non-Relational)
The database thread, positioned the way engines actually do it: the database is an **offline, editor-side tool**, and the runtime never queries it.

**Topics**:
- Build a SQLite asset database with tables for materials, meshes, and textures, plus a join table so several meshes can share one material. This is the genuine many-to-many and foreign-key exercise.
- Model the scene hierarchy two ways and compare directly: a relational adjacency-list table (node id, parent id, transform) versus a nested JSON document. Write "get all descendants of node X" in both and note which one is awkward and why — that contrast is the whole point of the exercise.
- Write a **bake step**: a command-line tool that reads the database and emits a single flat binary file laid out for fast sequential loading.
- **Deliverable tie-in**: the engine loads the baked binary. It never opens the database at runtime. This keeps a schema bug from ever blocking the graphics deliverable, and it is the honest version of how asset pipelines work.

#### Half B — Optimization (Months 10–11)

#### 4. Rendering (Performance Pipelines)
**Topics**:
- **Deferred rendering**: G-buffer layout, decoupling the light pass from geometry. This is an architectural rewrite of the render path, not a feature — budget for it accordingly.
- Screen-space effects: SSAO, bloom, HDR tone mapping
- Shadow map improvements: cascades or perspective shadow maps

#### 5. Mathematics (Calculus 2, and the start of multivariable)
**Resource**: *Calculus: Early Transcendentals (Stewart)*

**Topics**:
- Integration techniques and numerical approximation methods
- Infinite sequences and series
- Applications: physics integration loops (Euler and Verlet integration)
- **Begin multivariable early**: partial derivatives and gradients. Starting here is deliberate — it means Phase 4 is not learning Vulkan and multivariable calculus simultaneously.

#### 6. Algorithms & Data Structures
**Topics**:
- Spatial partitioning: bounding volume hierarchies (BVH) nesting primitives inside axis-aligned bounding boxes (AABBs); quadtrees (2D) and octrees (3D) for view culling
- Advanced partitioning: kD-trees for spatial nearest-neighbour queries
- Algorithms: ray-AABB intersection testing, hierarchical tree traversal
- **Implement a BVH from scratch** in the engine and use it for view frustum culling. Verify the culled-geometry count with the Phase 2 debug drawer.
- Interview patterns — **Graphs & Advanced DP**: topological sort, union-find, 2D DP (grids and strings). Continue medium/hard practice across all earlier patterns.

#### 7. Diagnostic & Tool Integrations
- **Tracy Profiler**: integrate it (or custom ImGui timer scopes) to track CPU and GPU frame boundaries and find CPU-side bottleneck loops.
- **Culling controls**: ImGui toggles for BVH and frustum culling overlays, showing live culled-geometry counts.
- **Frame-timing database**: pipe frame captures into SQLite (frame number, CPU time, GPU time, draw calls). Write real aggregate queries — slowest frames, average by scene, percentile breakdowns. This is the second half of the database thread and it feeds the portfolio artifact below directly.

#### 8. Consolidation Week & Portfolio Milestone
- No new material. Stabilise the engine, make the bake step reproducible from a clean clone.
- **Portfolio artifact**: a written performance case study — before and after frame times, what the profiler showed, what you changed, what it bought. The numbers come straight out of the frame-timing database, so this costs almost nothing if the database was built as specified. This is the single most valuable artifact in the entire plan for hiring.

---

### Phase 4: Explicit GPU Control — Vulkan (Months 12–13)

**Days 335–396, ending 2027-07-06. Deliverable: Vulkan Mesh Renderer.**

Vulkan only. Nothing else competes for these two months. The scope here matches what two months can actually produce: a correct, explicit, textured mesh renderer. PBR and image-based lighting are **not** in this phase — see Beyond the Horizon.

#### 1. Programming (Explicit GPU Control)
**Resource**: *Vulkan Tutorial (Overvoorde)*

**Topics**:
- Vulkan instances, validation layers, physical and logical devices
- Swapchains, render passes, framebuffers, command pools
- Graphics pipelines, descriptor sets, push constants
- Synchronization: semaphores, fences, and pipeline barriers
- Vertex and index buffers, staging buffers, device memory allocation
- Texture images, image views, samplers, and depth buffering

#### 2. Mathematics (Multivariable Calculus & Probability)
**Resource**: *Calculus (Stewart)*, plus any introductory probability text

**Topics**:
- Finish multivariable: double and triple integrals, gradients, curl, divergence
- **Probability and Monte Carlo basics**: random variables, expectation, variance, estimator bias, importance sampling. This was previously missing from the plan entirely, and nothing in physically based rendering makes sense without it.
- Applications: deriving the rendering equation and understanding BRDFs. Derived and understood here; implemented later.

#### 3. Algorithms & Data Structures
**Topics**:
- Half-edge data structure for polygon mesh adjacency queries in geometry processing. Implement it as an index-based structure — the whole point is cache-coherent traversal, so it stays in memory and is not modelled in a database.
- Sorting pipelines: radix sort or merge sort for depth-sorting transparent geometry back-to-front each frame
- LeetCode focus: sorting algorithm mechanics and advanced graph problems (adjacency lists)
- Interview patterns — **Trie, Backtracking, Advanced Graphs**: Word Search II, Design Add/Search Words, advanced graph traversal. Full pattern review at hard difficulty.

#### 4. Diagnostic & Tool Integrations
- **RenderDoc Vulkan validation**: analyse memory allocations, verify descriptor layouts, debug image layout transitions, and inspect device queues to resolve pipeline layout bugs.

#### 5. Consolidation Week & Portfolio Milestone
- No new material. Get the Vulkan renderer building from a clean clone on a second machine.
- **Portfolio artifact**: a written comparison of the OpenGL and Vulkan paths — what became explicit, what it cost, what it bought.
- **Full portfolio pass**: three repositories, each with a README, screenshots or video, and a clear statement of what it demonstrates. Plus the Phase 3 performance case study. This is the point of the thirteen months.

---

## Beyond the Horizon

Deliberately outside the 13-month plan. These were cut from Phase 4 because a two-month phase cannot absorb Vulkan *and* a physically based renderer, and pretending otherwise is how a plan quietly fails.

- Physically based rendering (PBR) shader implementation
- Image-based lighting (IBL) and pre-computed environment maps
- Multi-threaded command buffer recording
- Skeletal animation and skinning
- A job/task system for parallel subsystem updates
- Compute shaders and GPU-driven culling

The Phase 4 probability and rendering-equation work is the prerequisite for the first two. If the plan runs ahead of schedule, PBR is the first thing to pull forward.

---

## Interview Prep: DSA Patterns

The app rotates through ten algorithm patterns via the daily revision items on the pattern days of the weekly schedule, shown as the Weekly Algorithm indicator on the dashboard.

**Note on cycle drift**: the rotation is a 10-week loop, while the phases run 13 to 21 weeks. The rotation will therefore not stay aligned to the per-phase pattern groupings listed above — the phase text describes which patterns to *prioritise* in your own practice, while the rotation guarantees that no pattern goes more than ten weeks without review. Treat the rotation as spaced repetition and the phase groupings as focus, and do not try to force the two into sync.
`;
