# 12-Month Engine Developer Curriculum & Syllabus

This document serves as our shared reference roadmap for all four study phases. It outlines topics, resources, milestones, and diagnostic tool integrations in chronological order.

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

#### 4. Diagnostic & Git Milestones
- **GitHub Launch**: Create the public repository for `ray-tracer`.
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

#### 4. Diagnostic & Tool Integrations
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

#### 4. Diagnostic & Tool Integrations
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

#### 4. Diagnostic & Tool Integrations
- **RenderDoc Vulkan Validation**: Analyze memory allocations, verify descriptor layouts, debug layout transitions, and inspect device queues to resolve Vulkan pipeline layout bugs.
