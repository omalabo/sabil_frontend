import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null // ✅ AJOUTÉ
  mustChangePassword: boolean
  isLoading: boolean
  error: string | null
}

const loadAuthFromStorage = (): AuthState => {
  try {
    const token = localStorage.getItem('sabil_token')
    const refreshToken = localStorage.getItem('sabil_refresh_token') // ✅ AJOUTÉ
    const userStr = localStorage.getItem('sabil_user')
    const mustChangePassword = localStorage.getItem('sabil_must_change') === 'true'
    
    return {
      user: userStr ? JSON.parse(userStr) : null,
      token: token || null,
      refreshToken: refreshToken || null, // ✅ AJOUTÉ
      mustChangePassword,
      isLoading: false,
      error: null,
    }
  } catch {
    return { user: null, token: null, refreshToken: null, mustChangePassword: false, isLoading: false, error: null }
  }
}

const initialState: AuthState = loadAuthFromStorage()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{
      user: User
      token: string
      refreshToken: string // ✅ AJOUTÉ
      mustChangePassword: boolean
    }>) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken // ✅ AJOUTÉ
      state.mustChangePassword = action.payload.mustChangePassword
      state.error = null
      
      localStorage.setItem('sabil_token', action.payload.token)
      localStorage.setItem('sabil_refresh_token', action.payload.refreshToken) // ✅ AJOUTÉ
      localStorage.setItem('sabil_user', JSON.stringify(action.payload.user))
      localStorage.setItem('sabil_must_change', String(action.payload.mustChangePassword))
    },

    // ✅ NOUVEAU : Action utilisée par Axios pour mettre à jour les tokens sans déconnecter
    updateTokens: (state, action: PayloadAction<{ token: string; refreshToken: string }>) => {
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
      localStorage.setItem('sabil_token', action.payload.token)
      localStorage.setItem('sabil_refresh_token', action.payload.refreshToken)
    },

    loginFailure: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isLoading = false
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    logout: (state) => {
      state.user = null
      state.token = null
      state.refreshToken = null // ✅ AJOUTÉ
      state.mustChangePassword = false
      state.error = null
      localStorage.removeItem('sabil_token')
      localStorage.removeItem('sabil_refresh_token') // ✅ AJOUTÉ
      localStorage.removeItem('sabil_user')
      localStorage.removeItem('sabil_must_change')
    },

    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },

    passwordChanged: (state) => {
      state.mustChangePassword = false
      localStorage.setItem('sabil_must_change', 'false')
    },

    clearAuth: (state) => {
      state.user = null
      state.token = null
      state.refreshToken = null // ✅ AJOUTÉ
      state.mustChangePassword = false
      state.error = null
      localStorage.removeItem('sabil_token')
      localStorage.removeItem('sabil_refresh_token') // ✅ AJOUTÉ
      localStorage.removeItem('sabil_user')
      localStorage.removeItem('sabil_must_change')
    },
  },
})

export const {
  loginSuccess,
  updateTokens, // ✅ EXPORTÉ
  loginFailure,
  setLoading,
  logout,
  updateUser,
  passwordChanged,
  clearAuth,
} = authSlice.actions

export const selectAuth = (state: { auth: AuthState }) => state.auth
export default authSlice.reducer
