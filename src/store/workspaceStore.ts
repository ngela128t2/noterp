import { create } from 'zustand'

export type WorkspaceContextType = 'client' | 'project'

export interface WorkspaceContext {
  type: WorkspaceContextType
  id: string
  name?: string
}

type WorkspaceTab = 'timeline' | 'info' | 'contacts'

interface WorkspaceStore {
  activeContext: WorkspaceContext | null
  workspaceTab: WorkspaceTab
  setActiveContext: (ctx: WorkspaceContext | null) => void
  setWorkspaceTab: (tab: WorkspaceTab) => void
}

export const useWorkspaceStore = create<WorkspaceStore>(set => ({
  activeContext: null,
  workspaceTab: 'timeline',
  setActiveContext: ctx => set({ activeContext: ctx }),
  setWorkspaceTab: tab => set({ workspaceTab: tab }),
}))
