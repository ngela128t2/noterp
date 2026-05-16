import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WorkspaceContextType = 'client' | 'project'

export interface WorkspaceContext {
  type: WorkspaceContextType
  id: string
  name?: string
}

type WorkspaceTab = 'timeline' | 'info' | 'contacts'

interface WorkspaceStore {
  activeContext: WorkspaceContext | null
  lastContext: WorkspaceContext | null  // 가장 최근 방문한 워크스페이스 (메모 기본값으로 사용)
  workspaceTab: WorkspaceTab
  setActiveContext: (ctx: WorkspaceContext | null) => void
  setWorkspaceTab: (tab: WorkspaceTab) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    set => ({
      activeContext: null,
      lastContext: null,
      workspaceTab: 'timeline',
      setActiveContext: ctx => set({
        activeContext: ctx,
        // 워크스페이스 진입 시 lastContext 갱신 (null로 나갈 때는 유지)
        ...(ctx ? { lastContext: ctx } : {}),
      }),
      setWorkspaceTab: tab => set({ workspaceTab: tab }),
    }),
    {
      name: 'noterp-workspace',
      partialize: state => ({ lastContext: state.lastContext }), // lastContext만 영속화
    }
  )
)
