"use client";

import { useState } from "react";
import WorkspaceList from "./WorkspaceList";
import WorkspaceView from "./WorkspaceView";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { documents?: number };
};

export default function AuthenticatedApp() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  if (selectedWorkspace) {
    return (
      <WorkspaceView
        workspace={selectedWorkspace}
        onBack={() => setSelectedWorkspace(null)}
      />
    );
  }

  return <WorkspaceList onSelectWorkspace={setSelectedWorkspace} />;
}
