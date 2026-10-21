/** Flip the document theme class immediately (before React re-renders). */
export function applyThemeInstant(theme: "light" | "dark") {
  const root = document.documentElement
  root.classList.add("theme-switching")

  if (theme === "dark") {
    root.classList.add("dark")
    root.style.colorScheme = "dark"
  } else {
    root.classList.remove("dark")
    root.style.colorScheme = "light"
  }

  try {
    localStorage.setItem("theme", theme)
  } catch {
    /* private mode */
  }

  // Keep transitions suppressed through the next paint frames.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-switching")
    })
  })
}
