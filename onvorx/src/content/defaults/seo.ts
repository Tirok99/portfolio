import type { L, SeoEntry } from '../../admin/types'
import en from '../../i18n/en.json'

const same = (s: string): L => ({ en: s, uk: s })

export const defaultSeo: SeoEntry[] = [
  {
    pageKey: 'home',
    label: 'Home',
    path: '/',
    title: same(en.meta.title),
    description: same(en.meta.description),
  },
  {
    pageKey: 'services',
    label: 'Services',
    path: '/services',
    title: same('Services — ONVORX'),
    description: same(
      'Web development, website support, business analysis and Google Ads — ONVORX joins your project at the stage where support is needed.',
    ),
  },
  {
    pageKey: 'projects',
    label: 'Projects',
    path: '/projects',
    title: same('Projects — ONVORX'),
    description: same(
      'Selected web development work by ONVORX — websites and digital solutions built around real business requirements.',
    ),
  },
  {
    pageKey: 'about',
    label: 'About',
    path: '/about',
    title: same('About — ONVORX'),
    description: same(
      'ONVORX combines hands-on web development experience with a structured approach to requirements, implementation and ongoing development.',
    ),
  },
  {
    pageKey: 'web-development',
    label: 'Service — Web Development',
    path: '/web-development',
    title: same('Web Development — ONVORX'),
    description: same(
      'Build a new website from ready designs and requirements, with structure and UX/UI support when needed.',
    ),
  },
  {
    pageKey: 'support',
    label: 'Service — Website Support & Development',
    path: '/support',
    title: same('Website Support & Development — ONVORX'),
    description: same(
      'Improve and extend an existing WordPress or Horoshop website with new pages, functionality, integrations and ongoing support.',
    ),
  },
  {
    pageKey: 'business-analysis',
    label: 'Service — Business Analysis',
    path: '/business-analysis',
    title: same('Business Analysis — ONVORX'),
    description: same(
      'Clarify business processes, scope and requirements before automation or software development begins.',
    ),
  },
  {
    pageKey: 'google-ads',
    label: 'Service — Google Ads',
    path: '/google-ads',
    title: same('Google Ads — ONVORX'),
    description: same(
      'Set up and manage Google Ads campaigns as a separate channel for attracting relevant paid traffic.',
    ),
  },
]
