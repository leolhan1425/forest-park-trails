import useStore from '../../store/useStore'

export default function DistancePanel() {
  const trailheads = useStore((s) => s.trailheads)
  const distanceTrailhead = useStore((s) => s.distanceTrailhead)
  const setDistanceTrailhead = useStore((s) => s.setDistanceTrailhead)
  const targetMiles = useStore((s) => s.targetMiles)
  const setTargetMiles = useStore((s) => s.setTargetMiles)
  const reachableResult = useStore((s) => s.reachableResult)
  const clearDistance = useStore((s) => s.clearDistance)
  const trails = useStore((s) => s.trails)

  const sorted = trailheads ? [...trailheads].sort((a, b) => a.name.localeCompare(b.name)) : []

  // Count unique trail names in reachable segments
  const reachableTrails = reachableResult && trails
    ? [...new Set(
        reachableResult.segments
          .map((id) => trails.features.find((f) => f.properties.id === id)?.properties.trailName)
          .filter(Boolean)
      )]
    : []

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Pick a trailhead and distance to see how far you can go.
      </p>

      {/* Trailhead */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">Starting trailhead</label>
        <select
          value={distanceTrailhead || ''}
          onChange={(e) => setDistanceTrailhead(e.target.value || null)}
          className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm bg-white text-stone-800"
        >
          <option value="">Select trailhead...</option>
          {sorted.map((th) => (
            <option key={th.id} value={th.id}>{th.name}</option>
          ))}
        </select>
      </div>

      {/* Distance input */}
      <div>
        <label className="block text-xs font-medium text-stone-500 mb-1">Distance (miles)</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTargetMiles(Math.max(0.5, targetMiles - 0.5))}
            className="w-8 h-8 rounded border border-stone-300 text-stone-600 font-bold hover:bg-stone-100"
          >
            -
          </button>
          <input
            type="number"
            value={targetMiles}
            onChange={(e) => setTargetMiles(Math.max(0.5, Math.min(30, Number(e.target.value) || 0.5)))}
            step="0.5"
            min="0.5"
            max="30"
            className="flex-1 border border-stone-300 rounded px-2 py-1.5 text-sm text-center font-mono text-stone-800"
          />
          <button
            onClick={() => setTargetMiles(Math.min(30, targetMiles + 0.5))}
            className="w-8 h-8 rounded border border-stone-300 text-stone-600 font-bold hover:bg-stone-100"
          >
            +
          </button>
        </div>
      </div>

      {/* Results */}
      {reachableResult && (
        <div className="space-y-3">
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-sm text-stone-600">
              Within <strong>{targetMiles} mi</strong> you can reach:
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {reachableResult.segments.length} segments across {reachableTrails.length} trail{reachableTrails.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Endpoints */}
          {reachableResult.endpoints.length > 0 && (
            <div>
              <div className="text-xs font-medium text-stone-500 mb-1">You'd reach as far as:</div>
              <div className="space-y-1">
                {reachableResult.endpoints
                  .sort((a, b) => b.distance - a.distance)
                  .slice(0, 8)
                  .map((ep, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 px-2 border-b border-stone-100">
                      <span className="text-stone-700">{ep.label}</span>
                      <span className="text-stone-400 font-mono text-xs">{ep.distance} mi</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={clearDistance}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
