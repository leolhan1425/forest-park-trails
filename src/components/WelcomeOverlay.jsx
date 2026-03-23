import { useState } from 'react'

const DISMISSED_KEY = 'fpt-welcome-dismissed'

export default function WelcomeOverlay() {
  const [show, setShow] = useState(() => !localStorage.getItem(DISMISSED_KEY))

  if (!show) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="text-xl font-bold text-stone-800">Welcome to Forest Park Trails</h2>
          <p className="text-sm text-stone-500 mt-1">Portland's 5,200-acre urban forest — mapped</p>
        </div>

        <div className="space-y-3 text-sm text-stone-700">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">1</div>
            <div>
              <strong>Select Segments</strong> — Click trails on the map to build your route. Each click adds the segment and tracks your mileage.
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">2</div>
            <div>
              <strong>Plan a Route</strong> — Switch to the Route tab, pick start and end trailheads, and we'll find the shortest path.
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">3</div>
            <div>
              <strong>Out & Back</strong> — Planning to return the way you came? Toggle "Out & Back" to double your distance.
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-xs">4</div>
            <div>
              <strong>Share</strong> — Copy a link to share your route with friends.
            </div>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition-colors"
        >
          Start Exploring
        </button>
      </div>
    </div>
  )
}
