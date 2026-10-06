import { config } from '../../config/env.js'
export function isTrustedOrigin(origin) {
  if (origin === config.CLIENT_ORIGIN) return true
  if (config.NODE_ENV === 'production') return false
  try {
    const incoming = new URL(origin)
    const configured = new URL(config.CLIENT_ORIGIN)
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
    return (
      localHosts.has(incoming.hostname) &&
      localHosts.has(configured.hostname) &&
      incoming.protocol === configured.protocol &&
      incoming.port === configured.port &&
      incoming.origin === origin
    )
  } catch {
    return false
  }
}
