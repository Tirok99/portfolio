import { describe, it, expect, vi, beforeEach } from 'vitest'

// telegramBot.ts's real grammY integration is exercised in telegramBot.test.ts.
// This file tests the auth gate + the try/catch resilience wrapper around it,
// so the bot layer is mocked here rather than making a real getMe/sendMessage
// call for every case below.
const handleUpdateMock = vi.fn().mockResolvedValue(undefined)
const getBotMock = vi.fn().mockResolvedValue({ handleUpdate: handleUpdateMock })
vi.mock('./telegramBot', () => ({ getBot: getBotMock }))

const { handleTelegramWebhook } = await import('./telegramHandler')

const ENV = {
  TELEGRAM_BOT_TOKEN: '111:aaa',
  TELEGRAM_WEBHOOK_SECRET: 'shh',
  TELEGRAM_ADMIN_IDS: '111',
}

beforeEach(() => {
  handleUpdateMock.mockReset().mockResolvedValue(undefined)
})

describe('handleTelegramWebhook', () => {
  it('500 when not configured', async () => {
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: {} }, {})
    expect(r.status).toBe(500)
    expect(getBotMock).not.toHaveBeenCalled()
  })

  it('401 on a wrong secret header', async () => {
    const r = await handleTelegramWebhook({ secretHeader: 'wrong', body: {} }, ENV)
    expect(r.status).toBe(401)
    expect(getBotMock).not.toHaveBeenCalled()
  })

  it('401 on a missing secret header (undefined does not throw)', async () => {
    const r = await handleTelegramWebhook({ secretHeader: undefined, body: {} }, ENV)
    expect(r.status).toBe(401)
    expect(getBotMock).not.toHaveBeenCalled()
  })

  it('200 on a correct secret header, passing the parsed body to bot.handleUpdate', async () => {
    const update = { update_id: 1 }
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: update }, ENV)
    expect(r.status).toBe(200)
    expect(handleUpdateMock).toHaveBeenCalledWith(update)
  })

  it('still acks 200 even if the bot throws (Telegram retries hard on non-2xx)', async () => {
    handleUpdateMock.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: { update_id: 2 } }, ENV)
    expect(r.status).toBe(200)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('still acks 200 even if getBot itself rejects (e.g. a getMe network blip)', async () => {
    getBotMock.mockRejectedValueOnce(new Error('getMe failed'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await handleTelegramWebhook({ secretHeader: 'shh', body: { update_id: 3 } }, ENV)
    expect(r.status).toBe(200)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
