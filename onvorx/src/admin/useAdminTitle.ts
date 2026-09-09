import { useEffect } from 'react'

export function useAdminTitle(screen: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = `ONVORX Admin — ${screen}`
    return () => {
      document.title = previous
    }
  }, [screen])
}
