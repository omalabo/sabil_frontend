import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { store } from '../store/store'
import { logout, clearAuth, updateTokens } from '../store/authSlice'

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
})

// ── LOGIQUE ROBUSTE DE REFRESH TOKEN (File d'attente) ──
let isRefreshing = false
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void }[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState()
    const token = state.auth.token
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 🔴 Si erreur 401 ET que la requête n'a pas déjà été retentée
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // 1. Si un refresh est déjà en cours, on met la requête en file d'attente
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      // 2. On marque la requête comme "déjà retentée" et on verrouille le refresh
      originalRequest._retry = true
      isRefreshing = true

      try {
        const state = store.getState()
        const refreshToken = state.auth.refreshToken

        if (!refreshToken) {
          throw new Error('Aucun refresh token disponible')
        }

        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

        // 3. Appel au backend pour obtenir de NOUVEAUX tokens
        // On utilise axios de base (pas 'api') pour ne pas déclencher l'interceptor en boucle
        const { data } = await axios.post(`${baseUrl}/token/refresh/`, {
          refresh: refreshToken
        })

        const newAccessToken = data.access
        const newRefreshToken = data.refresh // Django renvoie un nouveau refresh token car ROTATE_REFRESH_TOKENS = True

        // 4. Mettre à jour le store et le localStorage
        store.dispatch(updateTokens({ 
          token: newAccessToken, 
          refreshToken: newRefreshToken 
        }))

        // 5. Traiter la file d'attente (relancer les autres requêtes en attente)
        processQueue(null, newAccessToken)

        // 6. Relancer la requête originale qui avait échoué avec le nouveau token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)

      } catch (refreshError) {
        // ⚠️ Le refresh a échoué (refresh token expiré après 7 jours, ou utilisateur banni)
        // Là seulement, on déconnecte vraiment l'utilisateur
        processQueue(refreshError, null)
        store.dispatch(clearAuth())
        store.dispatch(logout())
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        return Promise.reject(refreshError)
        
      } finally {
        // Dans tous les cas, on libère le verrou
        isRefreshing = false
      }
    }
    
    // Gestion des autres erreurs (403, 500, etc.)
    if (error.response?.status === 403) {
      console.warn('Accès refusé : permissions insuffisantes')
    }
    if (error.response?.status === 500) {
      console.error('Erreur serveur interne')
    }
    
    return Promise.reject(error)
  }
)

export default api
