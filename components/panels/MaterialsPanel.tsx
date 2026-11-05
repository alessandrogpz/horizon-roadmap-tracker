"use client";

import React from "react";
import MaterialsTracker from "@/components/MaterialsTracker";
import { useUndoableEdit } from "@/components/UndoBar";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import { addMaterial, removeMaterial, setMaterialArchived, setMaterialStatus, updateMaterial } from "@/lib/trackActions";
import { openLink } from "@/lib/systemLinks";
import { todayYMD } from "@/lib/dates";

/** Wires the materials list to the workspace. Every rule about what an edit
 *  does lives in lib/trackActions.ts; this is only plumbing. */
export default function MaterialsPanel() {
  const { track } = useWorkspace();
  const { commitTrack } = useWorkspaceActions();
  const undoable = useUndoableEdit();
  if (!track) return null;

  return (
    <MaterialsTracker
      materials={track.materials || []}
      onStatusChange={(id, status) =>
        commitTrack(setMaterialStatus(track, id, status, todayYMD()), "material status")
      }
      onProgressChange={(id, fields) => commitTrack(updateMaterial(track, id, fields), "material progress")}
      onAddMaterial={(material) => commitTrack(addMaterial(track, material), "material add")}
      onDeleteMaterial={(id) =>
        undoable("Material removed", () => void commitTrack(removeMaterial(track, id), "material delete"))
      }
      onArchiveChange={(id, archived) =>
        commitTrack(setMaterialArchived(track, id, archived), archived ? "material archive" : "material unarchive")
      }
      onOpenLink={(link) => {
        openLink(link).catch((err) => console.error("Failed to open link", err));
      }}
    />
  );
}
