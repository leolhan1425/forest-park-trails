import { useEffect, useState } from 'react'
import useStore from './store/useStore'
import TrailMap from './components/map/TrailMap'
import Sidebar from './components/panels/Sidebar'
import MobileDrawer from './components/panels/MobileDrawer'
import WelcomeOverlay from './components/WelcomeOverlay'
import { decodeStateFromURL } from './utils/urlState'

export default function App() {
  const setTrailData = useStore((s) => s.setTrailData)
  const trails = useStore((s) => s.trails)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [trailsRes, trailheadsRes, graphRes, boundaryRes] = await Promise.all([
          fetch('/data/trails.json'),
          fetch('/data/trailheads.json'),
          fetch('/data/graph.json'),
          fetch('/data/boundary.json'),
        ])
        const [trails, trailheads, graph, boundary] = await Promise.all([
          trailsRes.json(),
          trailheadsRes.json(),
          graphRes.json(),
          boundaryRes.json(),
        ])
        setTrailData({ trails, trailheads, graph, boundary })

        // Restore state from URL after data loads
        const urlState = decodeStateFromURL()
        if (urlState) {
          const store = useStore.getState()
          if (urlState.mode === 'select' && urlState.segments.length > 0) {
            store.setMode('select')
            for (const segId of urlState.segments) {
              const feat = trails.features.find((f) => f.properties.id === segId)
              if (feat) store.toggleSegment(segId, feat.properties.distanceMiles)
            }
            if (urlState.outAndBack) store.toggleOutAndBack()
          } else if (urlState.mode === 'route') {
            store.setMode('route')
            store.setStartTrailhead(urlState.startTrailhead)
            store.setEndTrailhead(urlState.endTrailhead)
            if (urlState.routeOutAndBack) store.toggleRouteOutAndBack()
          }
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [setTrailData])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-stone-100">
        <p className="text-lg text-stone-600">Loading trail data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-stone-100">
        <p className="text-lg text-red-600">Error loading data: {error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 relative">
        {trails && <TrailMap />}
      </div>
      <MobileDrawer />
      <WelcomeOverlay />
    </div>
  )
}
