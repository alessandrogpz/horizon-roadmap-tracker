"use client";

import Dashboard from "@/components/Dashboard";
import { UndoProvider } from "@/components/UndoBar";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";

export default function Home() {
  return (
    <WorkspaceProvider>
      {/* Inside the workspace provider, because undo restores a whole
          workspace and needs `commitWorkspace` to do it. */}
      <UndoProvider>
        <Dashboard />
      </UndoProvider>
    </WorkspaceProvider>
  );
}
