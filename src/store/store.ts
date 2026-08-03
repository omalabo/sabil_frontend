import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import authReducer from './authSlice'
import { apiSlice } from './apiSlice'

/**
 * Configuration du store Redux Toolkit
 * - authSlice : gestion authentification (user, token, rôle)
 * - apiSlice : cache RTK Query pour les appels API
 * 
 * Middleware inclus :
 * - redux-thunk : pour les actions asynchrones
 * - RTK Query middleware : pour le cache/revalidation API
 */
export const store = configureStore({
  reducer: {
    // Slice d'authentification
    auth: authReducer,
    // API slice RTK Query (doit être en dernier pour les middlewares)
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignorer les vérifications sur les objets non-sérialisables (Date, etc.)
        ignoredActions: ['auth/loginSuccess', 'auth/setUser'],
        ignoredPaths: ['auth.user', 'api.queries'],
      },
    }).concat(apiSlice.middleware),
  devTools: import.meta.env.DEV, // Activer Redux DevTools en développement uniquement
})

// Activer les listeners RTK Query (revalidation onFocus, onReconnect, etc.)
setupListeners(store.dispatch)

// Types exportés pour le typage des hooks
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch