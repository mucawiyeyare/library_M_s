import { api, body } from './api'
// Saves language/theme to the signed-in user's account. Failure is harmless: the
// choice is already applied and stored locally.
export async function savePreferences(values) {
  try {
    await api('/me/preferences', { method: 'PATCH', body: body(values) })
  } catch {
    /* Local preference still applies. */
  }
}
