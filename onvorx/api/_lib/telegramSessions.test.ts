import { describe, it, expect } from 'vitest'
import { MAIN_MENU_STATE } from './telegramSessions'

describe('MAIN_MENU_STATE', () => {
  it('is the main_menu screen with no extra data', () => {
    expect(MAIN_MENU_STATE).toEqual({ screen: 'main_menu' })
  })
})
