
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({
        top: 0,
        behavior: 'instant',
      })

      return
    }

    let targetId: string

    try {
      targetId = decodeURIComponent(hash.slice(1))
    } catch {
      return
    }

    let frameId = 0
    let attempts = 0

    const scrollToSection = () => {
      const section = document.getElementById(targetId)

      if (section) {
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      } else if (attempts < 10) {
        attempts += 1
        frameId = window.requestAnimationFrame(scrollToSection)
      }
    }

    frameId = window.requestAnimationFrame(scrollToSection)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [pathname, hash])

  return null
}
