"use client";

import React from "react";
import PortfolioTracker from "@/components/PortfolioTracker";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import {
  addPortfolioProject,
  removePortfolioProject,
  togglePortfolioProject,
  updatePortfolioProject,
} from "@/lib/trackActions";
import { todayYMD } from "@/lib/dates";

/** Wires the portfolio checklist to the workspace. */
export default function PortfolioPanel() {
  const { track } = useWorkspace();
  const { commitTrack } = useWorkspaceActions();
  if (!track) return null;

  return (
    <PortfolioTracker
      portfolio={track.portfolio}
      onToggle={(id) => commitTrack(togglePortfolioProject(track, id, todayYMD()), "portfolio toggle")}
      onAddProject={(project) => commitTrack(addPortfolioProject(track, project), "portfolio add")}
      onEditProject={(id, fields) => commitTrack(updatePortfolioProject(track, id, fields), "portfolio edit")}
      onDeleteProject={(id) => commitTrack(removePortfolioProject(track, id), "portfolio delete")}
    />
  );
}
