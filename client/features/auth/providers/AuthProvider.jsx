import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, body, refreshSession, setAccessToken } from '../../../shared/lib/api'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()
  useEffect(() => {
    let active = true
    void refreshSession()
      .then((data) => {
        if (active) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const signIn = async (input, register = false) => {
    const data = await api(register ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: body(input),
    })
    queryClient.clear()
    setAccessToken(data.accessToken)
    setUser(data.user)
  }
  const signOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
      setUser(null)
      queryClient.clear()
    }
  }
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth provider missing')
  return value
}
