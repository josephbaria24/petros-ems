type Listener = (loading: boolean) => void

let loading = false
const listeners = new Set<Listener>()

export function isNavLoading() {
  return loading
}

export function setNavLoading(next: boolean) {
  if (loading === next) return
  loading = next
  listeners.forEach((listener) => listener(loading))
}

export function startNavLoading() {
  setNavLoading(true)
}

export function stopNavLoading() {
  setNavLoading(false)
}

export function subscribeNavLoading(listener: Listener) {
  listeners.add(listener)
  listener(loading)
  return () => {
    listeners.delete(listener)
  }
}
