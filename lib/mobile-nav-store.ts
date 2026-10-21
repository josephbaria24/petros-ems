type Listener = (open: boolean) => void

let open = false
const listeners = new Set<Listener>()

export function getMobileNavOpen() {
  return open
}

export function setMobileNavOpen(next: boolean) {
  if (open === next) return
  open = next
  listeners.forEach((listener) => listener(open))
}

export function openMobileNav() {
  setMobileNavOpen(true)
}

export function closeMobileNav() {
  setMobileNavOpen(false)
}

export function subscribeMobileNav(listener: Listener) {
  listeners.add(listener)
  listener(open)
  return () => {
    listeners.delete(listener)
  }
}
