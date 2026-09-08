import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteContent } from '../../content/useSiteContent'
import { seoKeyForPath } from '../../data/routeSeo'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function DocumentHead() {
  const { pathname } = useLocation()
  const { seoFor } = useSiteContent()
  const { title, description } = seoFor(seoKeyForPath(pathname))

  useEffect(() => {
    if (title) document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
  }, [title, description])

  return null
}
