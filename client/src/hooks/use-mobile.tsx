import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    let mql: MediaQueryList | null = null

    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", updateIsMobile)
      } else if (typeof (mql as any).addListener === "function") {
        ;(mql as any).addListener(updateIsMobile)
      }
    } else {
      window.addEventListener("resize", updateIsMobile)
    }

    updateIsMobile()

    return () => {
      if (mql) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", updateIsMobile)
        } else if (typeof (mql as any).removeListener === "function") {
          ;(mql as any).removeListener(updateIsMobile)
        }
      } else {
        window.removeEventListener("resize", updateIsMobile)
      }
    }
  }, [])

  return !!isMobile
}
