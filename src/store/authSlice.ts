import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { User, UserRole } from '../types'

/**
 * Interface du state d'authentification
 */
interface AuthState {
  user: User | null
  token: string | null
  mustChangePassword: boolean
  isLoading: boolean
  error: string | null
}


// Fonction helper pour lire le state sauvegardé
const loadAuthFromStorage = (): AuthState => {
  try {
    const token = localStorage.getItem('sabil_token')
    const userStr = localStorage.getItem('sabil_user')
    const mustChangePassword = localStorage.getItem('sabil_must_change') === 'true'
    
    return {
      user: userStr ? JSON.parse(userStr) : null,
      token: token || null,
      mustChangePassword,
      isLoading: false,
      error: null,
    }
  } catch {
    return { user: null, token: null, mustChangePassword: false, isLoading: false, error: null }
  }
}

const initialState: AuthState = loadAuthFromStorage()  // ✅ remplace l'ancien initialState

/**
 * State initial : utilisateur non connecté
 */
/* const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('sabil_token'), // Persistance basique du token
  mustChangePassword: false,
  isLoading: false,
  error: null,
} */

/**
 * Slice Redux pour la gestion de l'authentification
 * - Actions synchrones : loginSuccess, logout, etc.
 * - Réducteurs : mise à jour immuable du state
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * ✅ Connexion réussie
     * @param state - State actuel (muté via Immer)
     * @param action - Payload avec user, token, mustChangePassword
     */
    loginSuccess: (state, action: PayloadAction<{
      user: User
      token: string
      mustChangePassword: boolean
    }>) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.mustChangePassword = action.payload.mustChangePassword
      state.error = null
      // Persister le token dans localStorage pour rechargement page
      //localStorage.setItem('sabil_token', action.payload.token)
      // ✅ Persister les 3 valeurs
      localStorage.setItem('sabil_token', action.payload.token)
      localStorage.setItem('sabil_user', JSON.stringify(action.payload.user))
      localStorage.setItem('sabil_must_change', String(action.payload.mustChangePassword))
    },

    /**
     * ❌ Échec de connexion
     */
    loginFailure: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.isLoading = false
    },

    /**
     * 🔄 Début de chargement (pour afficher spinner)
     */
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    /**
     * 🚪 Déconnexion utilisateur
     */
    logout: (state) => {
      state.user = null
      state.token = null
      state.mustChangePassword = false
      state.error = null
      //localStorage.removeItem('sabil_token')
      // ✅ Tout nettoyer
      localStorage.removeItem('sabil_token')
      localStorage.removeItem('sabil_user')
      localStorage.removeItem('sabil_must_change')
    },

    /**
     * 🔄 Mise à jour du profil utilisateur (après changement password, etc.)
     */
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },

    /**
     * ✅ Mot de passe forcé changé → débloquer l'accès
     */
    passwordChanged: (state) => {
      state.mustChangePassword = false
      localStorage.setItem('sabil_must_change', 'false')  // ✅ mettre à jour
    },

    /**
     * 🧹 Réinitialisation complète du state auth (déconnexion forcée)
     */
    clearAuth: (state) => {
      state.user = null
      state.token = null
      state.mustChangePassword = false
      state.error = null
      //localStorage.removeItem('sabil_token')
      localStorage.removeItem('sabil_token')
      localStorage.removeItem('sabil_user')
      localStorage.removeItem('sabil_must_change')
    },
  },
})

// Export des actions pour les dispatch dans les composants
export const {
  loginSuccess,
  loginFailure,
  setLoading,
  logout,
  updateUser,
  passwordChanged,
  clearAuth,
} = authSlice.actions

// Selector pour accéder au state auth depuis les composants
export const selectAuth = (state: { auth: AuthState }) => state.auth

export default authSlice.reducer