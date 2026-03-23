import { useState } from 'react'
import useStore from '../../store/useStore'
import RoutePanel from './RoutePanel'

export default function MobileDrawer() {
  const [open, setOpen] = useState(false)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const selectedSegments = useStore((s) => s.selectedSegments)
  const totalSelectedMiles = useStore((s) => s.totalSelectedMiles)
  const outAndBack = useStore((s) => s.outAndBack)
  const toggleOutAndBack = useStore((s) => s.toggleOutAndBack)
  const clearSelection = useStore((s) => s.clearSelection)
  const toggleSegment = useStore((s) => s.toggleSegment)
  const trails = useStore((s) => s.trails)
  const computedRoute = useStore((s) => s.computedRoute)

  const selectedList = trails
    ? trails.features.filter((f) => selectedSegments.has(f.properties.id))
    : []

  const displayMiles = outAndBack ? totalSelectedMiles * 2 : totalSelectedMiles

  const hasSomething = selectedSegments.size > 0 || computedRoute

  return (
    <div className="md:hidden">
      {/* Collapsed bar — always visible */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-300 shadow-lg z-[1000] px-4 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {/* Mode tabs */}
          <button
            className={`text-xs font-medium px-2 py-1 rounded ${
              mode === 'select' ? 'bg-teal-100 text-teal-700' : 'text-stone-500'
            }`}
            onClick={(e) => { e.stopPropagation(); setMode('select') }}
          >
            Segments
          </button>
          <button
            className={`text-xs font-medium px-2 py-1 rounded ${
              mode === 'route' ? 'bg-teal-100 text-teal-700' : 'text-stone-500'
            }`}
            onClick={(e) => { e.stopPropagation(); setMode('route') }}
          >
            Route
          </button>
        </div>

        {mode === 'select' && selectedSegments.size > 0 && (
          <div className="text-right">
            <span className="text-lg font-bold text-stone-800">{displayMiles.toFixed(2)} mi</span>
            <span className="text-xs text-stone-500 ml-1">
              ({selectedSegments.size} seg{outAndBack ? ', RT' : ''})
            </span>
          </div>
        )}

        {mode === 'route' && computedRoute && (
          <span className="text-lg font-bold text-stone-800">
            {computedRoute.distance.toFixed(2)} mi
          </span>
        )}

        <span className="text-stone-400 text-lg">{open ? '▼' : '▲'}</span>
      </div>

      {/* Expanded drawer */}
      {open && (
        <div className="fixed bottom-10 left-0 right-0 bg-white border-t border-stone-300 shadow-2xl z-[999] max-h-[60vh] overflow-y-auto p-4">
          {mode === 'select' && (
            <>
              {selectedSegments.size === 0 ? (
                <p className="text-sm text-stone-500">Tap trail segments to calculate mileage.</p>
              ) : (
                <>
                  <div className="space-y-1 mb-3">
                    {selectedList.map((f) => (
                      <div
                        key={f.properties.id}
                        className="flex justify-between text-sm py-1 px-2 border-b border-stone-100"
                        onClick={() => toggleSegment(f.properties.id, f.properties.distanceMiles)}
                      >
                        <span className="text-stone-700 flex-1 mr-2">{f.properties.name}</span>
                        <span className="text-stone-400 font-mono text-xs">
                          {f.properties.distanceMiles.toFixed(2)} mi
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={toggleOutAndBack}
                      className={`flex-1 py-1.5 rounded text-sm font-medium border ${
                        outAndBack
                          ? 'bg-teal-50 text-teal-700 border-teal-300'
                          : 'text-stone-600 border-stone-300'
                      }`}
                    >
                      {outAndBack ? 'Out & Back ✓' : 'Out & Back'}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1.5 rounded text-sm font-medium text-red-600 border border-red-200"
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {mode === 'route' && <RoutePanel />}
        </div>
      )}
    </div>
  )
}
