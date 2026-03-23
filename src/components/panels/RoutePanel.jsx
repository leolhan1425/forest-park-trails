import useStore from '../../store/useStore'
import PopularRoutes from './PopularRoutes'

export default function RoutePanel() {
  const trailheads = useStore((s) => s.trailheads)
  const startTrailhead = useStore((s) => s.startTrailhead)
  const endTrailhead = useStore((s) => s.endTrailhead)
  const setStartTrailhead = useStore((s) => s.setStartTrailhead)
  const setEndTrailhead = useStore((s) => s.setEndTrailhead)
  const computedRoute = useStore((s) => s.computedRoute)
  const routeOutAndBack = useStore((s) => s.routeOutAndBack)
  const toggleRouteOutAndBack = useStore((s) => s.toggleRouteOutAndBack)
  const clearRoute = useStore((s) => s.clearRoute)
  const trails = useStore((s) => s.trails)

  const sorted = trailheads ? [...trailheads].sort((a, b) => a.name.localeCompare(b.name)) : []

  // Get segment details for the computed route
  const routeSegments = computedRoute && trails
    ? computedRoute.segments.map((segId) =>
        trails.features.find((f) => f.properties.id === segId)
      ).filter(Boolean)
    : []

  const displayDistance = computedRoute
    ? routeOutAndBack ? computedRoute.distance * 2 : computedRoute.distance
    : 0

  return (
    <div className="space-y-4">
      {/* Start trailhead */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">Start</label>
        <select
          value={startTrailhead || ''}
          onChange={(e) => setStartTrailhead(e.target.value || null)}
          className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm bg-white text-stone-800"
        >
          <option value="">Select trailhead...</option>
          {sorted.map((th) => (
            <option key={th.id} value={th.id} disabled={th.id === endTrailhead}>
              {th.name}
            </option>
          ))}
        </select>
      </div>

      {/* End trailhead */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">End</label>
        <select
          value={endTrailhead || ''}
          onChange={(e) => setEndTrailhead(e.target.value || null)}
          className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm bg-white text-stone-800"
        >
          <option value="">Select trailhead...</option>
          {sorted.map((th) => (
            <option key={th.id} value={th.id} disabled={th.id === startTrailhead}>
              {th.name}
            </option>
          ))}
        </select>
      </div>

      {/* Swap button */}
      {startTrailhead && endTrailhead && (
        <button
          onClick={() => {
            const s = startTrailhead
            const e = endTrailhead
            setStartTrailhead(e)
            setEndTrailhead(s)
          }}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          Swap start/end
        </button>
      )}

      {/* No route found */}
      {startTrailhead && endTrailhead && !computedRoute && (
        <p className="text-sm text-amber-600">No route found between these trailheads.</p>
      )}

      {/* Route result */}
      {computedRoute && (
        <div className="space-y-3">
          <div className="bg-teal-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-stone-800">
              {displayDistance.toFixed(2)} mi
            </div>
            <div className="text-xs text-stone-500">
              {routeSegments.length} segment{routeSegments.length !== 1 ? 's' : ''}
              {routeOutAndBack && ' (round trip)'}
            </div>
          </div>

          {/* Out & Back toggle */}
          <button
            onClick={toggleRouteOutAndBack}
            className={`w-full py-1.5 px-3 rounded text-sm font-medium border transition-colors ${
              routeOutAndBack
                ? 'bg-teal-50 text-teal-700 border-teal-300'
                : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
            }`}
          >
            {routeOutAndBack ? 'Out & Back ✓' : 'Out & Back'}
          </button>

          {/* Segment list */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-stone-500 mb-1">Route segments:</div>
            {routeSegments.map((f) => (
              <div
                key={f.properties.id}
                className="flex justify-between text-sm py-1 px-2 border-b border-stone-100"
              >
                <span className="text-stone-700 flex-1 mr-2">{f.properties.name}</span>
                <span className="text-stone-400 font-mono text-xs whitespace-nowrap">
                  {f.properties.distanceMiles.toFixed(2)} mi
                </span>
              </div>
            ))}
          </div>

          {/* Clear */}
          <button
            onClick={clearRoute}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Clear route
          </button>
        </div>
      )}

      {!startTrailhead && !endTrailhead && (
        <>
          <p className="text-sm text-stone-500 mb-4">
            Select start and end trailheads, or pick a popular route below.
          </p>
          <PopularRoutes />
        </>
      )}
    </div>
  )
}
