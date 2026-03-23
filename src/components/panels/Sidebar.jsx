import { useState } from 'react'
import useStore from '../../store/useStore'
import RoutePanel from './RoutePanel'
import ElevationProfile from './ElevationProfile'
import { encodeStateToURL } from '../../utils/urlState'

export default function Sidebar() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const selectedSegments = useStore((s) => s.selectedSegments)
  const totalSelectedMiles = useStore((s) => s.totalSelectedMiles)
  const outAndBack = useStore((s) => s.outAndBack)
  const toggleOutAndBack = useStore((s) => s.toggleOutAndBack)
  const clearSelection = useStore((s) => s.clearSelection)
  const toggleSegment = useStore((s) => s.toggleSegment)
  const trails = useStore((s) => s.trails)
  const startTrailhead = useStore((s) => s.startTrailhead)
  const endTrailhead = useStore((s) => s.endTrailhead)
  const routeOutAndBack = useStore((s) => s.routeOutAndBack)
  const [copied, setCopied] = useState(false)

  const selectedList = trails
    ? trails.features.filter((f) => selectedSegments.has(f.properties.id))
    : []

  const canShare = (mode === 'select' && selectedSegments.size > 0) ||
    (mode === 'route' && startTrailhead && endTrailhead)

  function handleShare() {
    const url = encodeStateToURL({
      mode, selectedSegments, outAndBack,
      startTrailhead, endTrailhead, routeOutAndBack,
    })
    const fullUrl = window.location.origin + window.location.pathname + url
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const displayMiles = outAndBack ? totalSelectedMiles * 2 : totalSelectedMiles

  return (
    <div className="w-80 bg-white border-r border-stone-200 flex flex-col h-full overflow-hidden max-md:hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 bg-gradient-to-b from-teal-800 to-teal-900 text-white">
        <h1 className="text-lg font-bold tracking-tight">Forest Park Trails</h1>
        <p className="text-xs text-teal-200">Portland, Oregon &middot; 80+ miles of trails</p>
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-stone-200">
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            mode === 'select'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-stone-500 hover:text-stone-700'
          }`}
          onClick={() => setMode('select')}
        >
          Select Segments
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${
            mode === 'route'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-stone-500 hover:text-stone-700'
          }`}
          onClick={() => setMode('route')}
        >
          Plan Route
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'select' && (
          <>
            {selectedSegments.size === 0 ? (
              <p className="text-sm text-stone-500">
                Click trail segments on the map to calculate mileage.
              </p>
            ) : (
              <div className="space-y-1">
                {selectedList.map((f) => (
                  <div
                    key={f.properties.id}
                    className="flex justify-between items-center text-sm py-1.5 px-2 border-b border-stone-100 hover:bg-stone-50 rounded cursor-pointer group"
                    onClick={() => toggleSegment(f.properties.id, f.properties.distanceMiles)}
                  >
                    <span className="text-stone-700 flex-1 mr-2">{f.properties.name}</span>
                    <span className="text-stone-400 font-mono text-xs whitespace-nowrap">
                      {f.properties.distanceMiles.toFixed(2)} mi
                    </span>
                    <span className="text-red-400 opacity-0 group-hover:opacity-100 ml-2 text-xs">
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'route' && <RoutePanel />}
      </div>

      {/* Elevation profile */}
      <ElevationProfile />

      {/* Footer with mileage */}
      {mode === 'select' && selectedSegments.size > 0 && (
        <div className="p-4 border-t border-stone-200 bg-stone-50">
          {/* Out & Back toggle */}
          <button
            onClick={toggleOutAndBack}
            className={`w-full mb-3 py-1.5 px-3 rounded text-sm font-medium border transition-colors ${
              outAndBack
                ? 'bg-teal-50 text-teal-700 border-teal-300'
                : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
            }`}
          >
            {outAndBack ? 'Out & Back ✓' : 'Out & Back'}
          </button>

          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold text-stone-800">
                {displayMiles.toFixed(2)} mi
              </div>
              <div className="text-xs text-stone-500">
                {selectedSegments.size} segment{selectedSegments.size !== 1 ? 's' : ''}
                {outAndBack && ' (round trip)'}
              </div>
            </div>
            <button
              onClick={clearSelection}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Share button */}
      {canShare && (
        <div className="px-4 pb-3 bg-stone-50">
          <button
            onClick={handleShare}
            className="w-full py-1.5 rounded text-sm font-medium bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            {copied ? 'Link copied!' : 'Copy share link'}
          </button>
        </div>
      )}

      {/* Ko-fi */}
      <div className="p-3 border-t border-stone-200 text-center">
        <a
          href="https://ko-fi.com/forestparktrails"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-stone-500 hover:text-teal-600 transition-colors"
        >
          Like this map? Buy me a coffee
        </a>
      </div>
    </div>
  )
}
