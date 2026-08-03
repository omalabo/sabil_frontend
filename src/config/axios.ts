import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { store } from '../store/store'
import { logout, clearAuth } from '../store/authSlice'

/**
 * Instance Axios configurée pour l'API Django DRF
 * - Base URL depuis variables d'environnement
 * - Interceptor pour injection automatique du token JWT
 * - Gestion centralisée des erreurs 401/403/500
 */
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000, // 30 secondes
})

/**
 * Interceptor de requête : ajoute le token JWT à chaque appel API
 * Exécuté AVANT l'envoi de la requête au serveur
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState()
    const token = state.auth.token
    
    if (token && config.headers) {
      // Format : "Bearer <token>" selon standard JWT
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

/**
 * Interceptor de réponse : gère les erreurs globales
 * Exécuté APRÈS la réponse du serveur (succès ou erreur)
 */
api.interceptors.response.use(
  (response) => response, // Succès : on retourne la réponse telle quelle
  async (error: AxiosError) => {
    const originalRequest = error.config
    
    // 🔴 Erreur 401 : token expiré ou invalide → déconnexion forcée
    if (error.response?.status === 401) {
      store.dispatch(clearAuth())
      store.dispatch(logout())
      // Optionnel : rediriger vers login via événement custom
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      return Promise.reject(error)
    }
    
    // 🟡 Erreur 403 : permissions insuffisantes
    if (error.response?.status === 403) {
      console.warn('Accès refusé : permissions insuffisantes')
      // Optionnel : afficher toast d'erreur
      return Promise.reject(error)
    }
    
    // 🔵 Erreur 500 : problème serveur
    if (error.response?.status === 500) {
      console.error('Erreur serveur interne')
      // Optionnel : notifier l'utilisateur
      return Promise.reject(error)
    }
    
    return Promise.reject(error)
  }
)

export default api