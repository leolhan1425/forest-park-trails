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

  return (
    <div className="md:hidden">
      {/* Collapsed bar — always visible, tappable to expand */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-300 shadow-lg z-[1000] px-3 py-2 flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <button
            className={`text-xs font-medium px-2 py-1 rounded ${
              mode === 'select' ? 'bg-teal-100 text-teal-700' : 'text-stone-500'
            }`}
            onClick={(e) => { e.stopPropagation(); setMode('select'); setOpen(false) }}
          >
            Segments
          </button>
          <button
            className={`text-xs font-medium px-2 py-1 rounded ${
              mode === 'route' ? 'bg-teal-100 text-teal-700' : 'text-stone-500'
            }`}
            onClick={(e) => { e.stopPropagation(); setMode('route'); setOpen(true) }}
          >
            Route
          </button>
        </div>

        {mode === 'select' && selectedSegments.size > 0 && (
          <div className="text-right">
            <span className="text-lg font-bold text-stone-800">{displayMiles.toFixed(2)} mi</span>
            <span className="text-xs text-stone-500 ml-1">
              ({selectedSegments.size}{outAndBack ? ' RT' : ''})
            </span>
          </div>
        )}

        {mode === 'route' && computedRoute && (
          <span className="text-lg font-bold text-stone-800">
            {computedRoute.distance.toFixed(2)} mi
          </span>
        )}

        <span className="text-stone-400">{open ? '▼' : '▲'}</span>
      </div>

      {/* Expanded drawer */}
      {open && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-[998]"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-11 left-0 right-0 bg-white border-t border-stone-300 shadow-2xl z-[999] max-h-[55vh] overflow-y-auto p-4">
            {mode === 'select' && (
              <>
                {selectedSegments.size === 0 ? (
                  <p className="text-sm text-stone-500">Tap trail segments on the map to calculate mileage.</p>
                ) : (
                  <>
                    <div className="space-y-1 mb-3">
                      {selectedList.map((f) => (
                        <div
                          key={f.properties.id}
                          className="flex justify-between text-sm py-1.5 px-2 border-b border-stone-100"
                          onClick={(e) => { e.stopPropagation(); toggleSegment(f.properties.id, f.properties.distanceMiles) }}
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
                        onClick={(e) => { e.stopPropagation(); toggleOutAndBack() }}
                        className={`flex-1 py-1.5 rounded text-sm font-medium border ${
                          outAndBack
                            ? 'bg-teal-50 text-teal-700 border-teal-300'
                            : 'text-stone-600 border-stone-300'
                        }`}
                      >
                        {outAndBack ? 'Out & Back ✓' : 'Out & Back'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); clearSelection() }}
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

            {/* Ko-fi */}
            <div className="mt-4 pt-3 border-t border-stone-200 text-center">
              <a
                href="https://ko-fi.com/forestparktrails"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-700 font-medium hover:text-teal-900"
              >
                Like this map? Help support the site
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
