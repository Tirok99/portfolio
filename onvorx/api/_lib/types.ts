export interface AuthEnv {
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
}

export interface HandlerResult {
  status: number
  body: unknown
  setCookie?: string
}
