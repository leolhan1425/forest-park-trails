import { create } from 'zustand'
import { findShortestPath } from '../utils/pathfinder'

const useStore = create((set, get) => ({
  // Mode
  mode: 'select', // 'select' | 'route'

  // Trail data (loaded on init)
  trails: null,
  trailheads: null,
  graph: null,
  boundary: null,

  // Segment selection mode
  selectedSegments: new Set(),
  totalSelectedMiles: 0,
  outAndBack: false,

  // Route mode
  startTrailhead: null,
  endTrailhead: null,
  computedRoute: null, // { segments: [ids], distance, path: [nodeIds] }
  routeOutAndBack: false,

  // Actions
  setMode: (mode) => set({ mode }),

  setTrailData: ({ trails, trailheads, graph, boundary }) =>
    set({ trails, trailheads, graph, boundary }),

  toggleSegment: (segmentId, distanceMiles) => {
    const { selectedSegments, totalSelectedMiles } = get()
    const next = new Set(selectedSegments)
    let nextMiles = totalSelectedMiles
    if (next.has(segmentId)) {
      next.delete(segmentId)
      nextMiles -= distanceMiles
    } else {
      next.add(segmentId)
      nextMiles += distanceMiles
    }
    set({ selectedSegments: next, totalSelectedMiles: Math.max(0, nextMiles) })
  },

  clearSelection: () =>
    set({ selectedSegments: new Set(), totalSelectedMiles: 0, outAndBack: false }),

  toggleOutAndBack: () => set((s) => ({ outAndBack: !s.outAndBack })),

  setStartTrailhead: (id) => {
    set({ startTrailhead: id })
    get().computeRoute()
  },

  setEndTrailhead: (id) => {
    set({ endTrailhead: id })
    get().computeRoute()
  },

  toggleRouteOutAndBack: () => set((s) => ({ routeOutAndBack: !s.routeOutAndBack })),

  computeRoute: () => {
    const { startTrailhead, endTrailhead, graph, trailheads } = get()
    if (!startTrailhead || !endTrailhead || !graph) {
      set({ computedRoute: null })
      return
    }

    const startTh = trailheads.find((t) => t.id === startTrailhead)
    const endTh = trailheads.find((t) => t.id === endTrailhead)
    if (!startTh?.nodeId || !endTh?.nodeId) {
      set({ computedRoute: null })
      return
    }

    const result = findShortestPath(graph, startTh.nodeId, endTh.nodeId)
    set({ computedRoute: result })
  },

  clearRoute: () =>
    set({ startTrailhead: null, endTrailhead: null, computedRoute: null, routeOutAndBack: false }),
}))

export default useStore
