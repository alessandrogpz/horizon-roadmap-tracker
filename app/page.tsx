"use client";

import Dashboard from "@/components/Dashboard";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";

export default function Home() {
  return (
    <WorkspaceProvider>
      <Dashboard />
    </WorkspaceProvider>
  );
}
