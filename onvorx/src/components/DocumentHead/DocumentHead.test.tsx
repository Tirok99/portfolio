import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { DocumentHead } from './DocumentHead'

beforeEach(() => localStorage.clear())

const metaDesc = () =>
  document.querySelector('meta[name="description"]')?.getAttribute('content')

function EditAboutSeo() {
  const { actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateSeo('about', {
          title: { en: 'Edited About Title', uk: 'Edited About Title' },
        })
      }
    >
      edit
    </button>
  )
}

const mount = (path: string) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter initialEntries={[path]}>
          <DocumentHead />
        </MemoryRouter>
        <EditAboutSeo />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('DocumentHead', () => {
  it('sets the document title and meta description for the home route', () => {
    mount('/')
    expect(document.title).toMatch(/ONVORX/)
    expect(metaDesc()).toBeTruthy()
  })

  it('uses the About SEO entry on /about and reflects store edits', () => {
    const { getByText } = mount('/about')
    expect(document.title).toMatch(/About/)
    act(() => getByText('edit').click())
    expect(document.title).toBe('Edited About Title')
  })

  it('falls back to home SEO for an unknown route', () => {
    mount('/nope')
    expect(document.title).toMatch(/ONVORX/)
  })

  it('falls back to home SEO for a mapped-but-unrendered route (/projects)', () => {
    // /projects has a ROUTE_SEO entry but is not a registered route, so it
    // renders NotFoundPage — DocumentHead must not stamp the "Projects" title.
    mount('/projects')
    expect(document.title).not.toMatch(/Projects/)
    expect(document.title).toMatch(/ONVORX/)
  })
})
