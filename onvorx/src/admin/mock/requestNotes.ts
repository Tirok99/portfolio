import type { RequestNote } from '../types'

export const mockRequestNotes: Record<string, RequestNote[]> = {
  req_0001: [],
  req_0002: [],
  req_0003: [
    {
      id: 'note_0001',
      createdAt: '2026-09-01T08:00:00.000Z',
      author: 'Admin (web)',
      body: 'Sent intro call link, waiting for a slot.',
    },
  ],
  req_0004: [],
  req_0005: [
    {
      id: 'note_0002',
      createdAt: '2026-09-06T10:00:00.000Z',
      author: 'Admin (web)',
      body: 'Delivered 2026-09-06. Invoice sent.',
    },
  ],
  req_0006: [],
  req_0007: [
    {
      id: 'note_0003',
      createdAt: '2026-07-19T16:00:00.000Z',
      author: 'Owner',
      body: 'Not a fit — archived.',
    },
  ],
}
