import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './store'

/**
 * Hooks typés pour Redux
 * - useAppDispatch : dispatch avec typage complet des actions
 * - useAppSelector : selector avec typage complet du state
 * 
 * À utiliser à la place de useDispatch/useSelector standards
 * pour bénéficier de l'auto-complétion TypeScript
 */

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector