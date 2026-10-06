let accessToken = null
let refreshing = null
export function setAccessToken(token) {
  accessToken = token
}
export class RequestError extends Error {
  status
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
async function parse(response) {
  if (response.status === 204) return undefined
  const data = await response
    .json()
    .catch(() => ({ message: 'The API is unavailable. Check that the server is running.' }))
  if (!response.ok) throw new RequestError(response.status, data.message ?? 'Request failed')
  return data
}
export async function refreshSession() {
  if (!refreshing)
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(parse)
      .then((data) => {
        accessToken = data.accessToken
        return data
      })
      .finally(() => {
        refreshing = null
      })
  return refreshing
}
export async function api(path, options = {}) {
  const request = () =>
    fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    })
  let response
  try {
    response = await request()
  } catch {
    throw new RequestError(
      503,
      'Cannot reach the server. Please check your connection and try again.',
    )
  }
  if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
    try {
      await refreshSession()
      response = await request()
    } catch {
      accessToken = null
      throw new RequestError(401, 'Your session has expired. Please sign in again.')
    }
  }
  if (response.ok && response.headers.get('content-type')?.includes('text/csv'))
    return await response.blob()
  return parse(response)
}
export const body = (data) => JSON.stringify(data)
