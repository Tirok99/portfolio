import { describe, it, expect } from 'vitest'
import {
  buildMainMenu,
  buildStubReply,
  buildNoAccessReply,
  buildAdminsList,
  buildAddIdPrompt,
  buildRolePrompt,
  buildLabelPrompt,
  buildRemoveConfirm,
  canAccessSection,
} from './telegramMenu'
import type { ManagerRecord } from './telegramAdmins'

const readButtons = (reply: ReturnType<typeof buildMainMenu>) =>
  reply.keyboard!.inline_keyboard.flat().map((b) => ({ text: b.text, data: (b as { callback_data?: string }).callback_data }))

const MANAGER: ManagerRecord = {
  telegramId: 42,
  role: 'content_manager',
  label: 'Anna',
  addedBy: 111,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('buildMainMenu', () => {
  it('owner sees all six sections', () => {
    const buttons = readButtons(buildMainMenu('owner'))
    expect(buttons.map((b) => b.text)).toEqual([
      'Content', 'Projects', 'Services', 'SEO', 'Requests', 'Administrators',
    ])
    expect(buttons.find((b) => b.text === 'Administrators')?.data).toBe('menu:admins')
    expect(buttons.find((b) => b.text === 'Content')?.data).toBe('stub:content')
  })
  it('content_manager sees only content sections, no Administrators', () => {
    const buttons = readButtons(buildMainMenu('content_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Content', 'Projects', 'Services', 'SEO'])
  })
  it('sales_manager sees only Requests', () => {
    const buttons = readButtons(buildMainMenu('sales_manager'))
    expect(buttons.map((b) => b.text)).toEqual(['Requests'])
  })
})

describe('buildStubReply', () => {
  it('names the section', () => {
    expect(buildStubReply('Content').text).toContain('Content')
  })
})

describe('buildNoAccessReply', () => {
  it('has no keyboard', () => {
    expect(buildNoAccessReply().keyboard).toBeUndefined()
  })
})

describe('buildAdminsList', () => {
  it('empty list still offers Add manager and Back', () => {
    const r = buildAdminsList([])
    expect(readButtons(r).map((b) => b.text)).toEqual(['➕ Add manager', '⬅ Back'])
  })
  it('lists each manager with a remove button, then Add manager, then Back', () => {
    const r = buildAdminsList([MANAGER])
    expect(r.text).toContain('Anna')
    expect(r.text).toContain('Content manager')
    const buttons = readButtons(r)
    expect(buttons[0]).toEqual({ text: '🗑 Remove Anna', data: 'admins:remove:42' })
    expect(buttons[1].text).toBe('➕ Add manager')
    expect(buttons[2]).toEqual({ text: '⬅ Back', data: 'menu:main' })
  })
})

describe('canAccessSection', () => {
  it('owner can access admins', () => {
    expect(canAccessSection('owner', 'admins')).toBe(true)
  })
  it('content_manager can access content but not admins or requests', () => {
    expect(canAccessSection('content_manager', 'content')).toBe(true)
    expect(canAccessSection('content_manager', 'admins')).toBe(false)
    expect(canAccessSection('content_manager', 'requests')).toBe(false)
  })
  it('sales_manager can access requests but not content', () => {
    expect(canAccessSection('sales_manager', 'requests')).toBe(true)
    expect(canAccessSection('sales_manager', 'content')).toBe(false)
  })
  it('returns false for an unknown section key', () => {
    expect(canAccessSection('owner', 'not-a-real-section')).toBe(false)
  })
})

describe('add-manager prompts', () => {
  it('buildAddIdPrompt has no keyboard', () => {
    expect(buildAddIdPrompt().keyboard).toBeUndefined()
  })
  it('buildRolePrompt offers both roles', () => {
    const buttons = readButtons(buildRolePrompt())
    expect(buttons).toEqual([
      { text: 'Content manager', data: 'admins:add:role:content_manager' },
      { text: 'Sales manager', data: 'admins:add:role:sales_manager' },
    ])
  })
  it('buildLabelPrompt offers Skip', () => {
    expect(readButtons(buildLabelPrompt())).toEqual([{ text: 'Skip', data: 'admins:add:skip_label' }])
  })
})

describe('buildRemoveConfirm', () => {
  it('names the target and offers Yes/Cancel', () => {
    const r = buildRemoveConfirm(MANAGER)
    expect(r.text).toContain('Anna')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, remove', data: 'admins:remove:confirm:42' },
      { text: 'Cancel', data: 'admins:remove:cancel' },
    ])
  })
  it('falls back to the numeric id when there is no label', () => {
    const noLabel = { ...MANAGER, label: null }
    expect(buildRemoveConfirm(noLabel).text).toContain('42')
  })
})
