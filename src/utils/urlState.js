/**
 * Encode/decode app state to/from URL search params.
 *
 * Segment mode: ?segments=seg-1,seg-3,seg-7&oab=1
 * Route mode:   ?start=th-1&end=th-5&roab=1
 */

export function encodeStateToURL(state) {
  const params = new URLSearchParams()

  if (state.mode === 'select' && state.selectedSegments.size > 0) {
    params.set('segments', [...state.selectedSegments].join(','))
    if (state.outAndBack) params.set('oab', '1')
  }

  if (state.mode === 'route' && state.startTrailhead && state.endTrailhead) {
    params.set('start', state.startTrailhead)
    params.set('end', state.endTrailhead)
    if (state.routeOutAndBack) params.set('roab', '1')
  }

  const search = params.toString()
  return search ? `?${search}` : ''
}

export function decodeStateFromURL() {
  const params = new URLSearchParams(window.location.search)

  // Segment mode
  const segStr = params.get('segments')
  if (segStr) {
    return {
      mode: 'select',
      segments: segStr.split(',').filter(Boolean),
      outAndBack: params.get('oab') === '1',
    }
  }

  // Route mode
  const start = params.get('start')
  const end = params.get('end')
  if (start && end) {
    return {
      mode: 'route',
      startTrailhead: start,
      endTrailhead: end,
      routeOutAndBack: params.get('roab') === '1',
    }
  }

  return null
}
