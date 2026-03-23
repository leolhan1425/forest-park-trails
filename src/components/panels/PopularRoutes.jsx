import useStore from '../../store/useStore'

const POPULAR = [
  {
    name: 'Lower Macleay to Pittock Mansion',
    description: 'Classic Forest Park hike through old-growth forest',
    start: 'th-1',
    end: 'th-19',
    outAndBack: true,
  },
  {
    name: 'Thurman Gate to NW 53rd',
    description: 'Leif Erikson out-and-back, flat and wide',
    start: 'th-2',
    end: 'th-10',
    outAndBack: true,
  },
  {
    name: 'Lower Saltzman to Germantown',
    description: 'Moderate loop via Wildwood and Leif Erikson',
    start: 'th-11',
    end: 'th-14',
    outAndBack: false,
  },
  {
    name: 'Wildwood: Thurman to Germantown',
    description: 'Long day hike on the Wildwood Trail spine',
    start: 'th-2',
    end: 'th-15',
    outAndBack: false,
  },
  {
    name: 'NW 53rd Loop via Dogwood & Leif',
    description: 'Popular after-work loop from NW 53rd',
    start: 'th-9',
    end: 'th-10',
    outAndBack: false,
  },
  {
    name: 'Newberry Road to Newton Road',
    description: 'Quiet northern section of the Wildwood Trail',
    start: 'th-18',
    end: 'th-17',
    outAndBack: true,
  },
]

export default function PopularRoutes() {
  const setMode = useStore((s) => s.setMode)
  const setStartTrailhead = useStore((s) => s.setStartTrailhead)
  const setEndTrailhead = useStore((s) => s.setEndTrailhead)
  const toggleRouteOutAndBack = useStore((s) => s.toggleRouteOutAndBack)
  const routeOutAndBack = useStore((s) => s.routeOutAndBack)

  function selectRoute(route) {
    setMode('route')
    // Reset out-and-back if currently on
    if (routeOutAndBack) toggleRouteOutAndBack()
    setStartTrailhead(route.start)
    setEndTrailhead(route.end)
    if (route.outAndBack) toggleRouteOutAndBack()
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-stone-500 uppercase tracking-wide">Popular Routes</div>
      {POPULAR.map((route, i) => (
        <button
          key={i}
          onClick={() => selectRoute(route)}
          className="w-full text-left p-2 rounded border border-stone-200 hover:border-teal-300 hover:bg-teal-50 transition-colors"
        >
          <div className="text-sm font-medium text-stone-800">{route.name}</div>
          <div className="text-xs text-stone-500">{route.description}</div>
          {route.outAndBack && (
            <span className="inline-block mt-1 text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
              Out & Back
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
