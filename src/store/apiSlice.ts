import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { RootState } from './store'
import { 
  User, Class, Message, PrivateMessage, Seance, Devoir, 
  Facture, PlanningDispo, Notification, DashboardEleve,
  PaginatedResponse, Inscription , EleveDevoir, Cours, PaginatedCours, GetCoursParams, 
  PresenceFacturable, SuiviPresence, FactureCreatePayload, FacturePreview, FactureAdmin,
  FactureEleve, PaginatedFactures, ClasseLight, PresenceProf, AbsenceEleveRow, 
  FactureParticipant, ParticipantsPaymentPayload,DashboardFilters, DirectionDashboardData,
  ClasseOption, ProfesseurOption, PlanningItem, PlanningFilters, PlanningResponse,
  SeancesToday, UpdateSeancePayload, CreateSeancePayload, FactureDetailSeances, FactureEleveItem,
  SubmitFacturePayload, PaginatedFactureEleve, PayerPayload, FactureElevePayeItem,
  AbsenceSignaler, AbsenceFilters, PaginatedAbsences,AdminCalendarResponse,
  TacheDirection,TacheDirectionPayload,MarquerFaitePayload,AdminUser,AnnoncesGroupe,
  AnnoncesGroupePayload,AnnonceEleve,ClasseSimple,EleveSimple,ProfDashboardStats,EleveDashboardStats,
  Diplome, CreateDiplomePayload, EleveOption, AdminEleveAPayer
} from '../types'

/**
 * RTK Query API Slice - Configuration centrale
 * - Cache automatique + revalidation intelligente
 * - Injection JWT automatique
 * - Typage fort + tags pour invalidation ciblée
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),

  // 🔹 Tags étendus pour gestion fine du cache
  tagTypes: [
    'Users', 'Classes', 'Messages', 'Seances', 'Devoirs', 
    'Factures', 'Notifications', 'Students', 'Inscriptions', 'Devoir','DevoirEleve',
    'CatalogueCours', 'PresencesFacturables','SuiviPresences','FacturesEmises','FactureAdmin',
     'FactureEleve',  'ClasseLight', 'AbsenceEleve', 'PresenceProf', 'AbsencesProfs','Planning','Absence',
     'TachesDirection', 'AdminsAssignables','AnnoncesGroupe', 'MesAnnonces','FacturesEleve','DirectionDashboard',
      'Diplomes', 'ElevesClasse','Diplome'
  ],

  endpoints: (builder) => ({
    // ==================== AUTH ====================
    
    login: builder.mutation<{
      message: string
      role: string
      must_change_password: boolean
      token: string
      refresh: string
      user: {
        id: string
        email: string
        display_name: string
        role: string
        must_change_password: boolean
        is_active: boolean
      }
    }, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login/',
        method: 'POST',
        body: credentials,
      }),
      extraOptions: { cache: 'no-store' },
    }),

    changePassword: builder.mutation<{ message: string }, { old_password: string; new_password: string }>({
      query: (body) => ({ url: '/auth/change-password/', method: 'POST', body }),
    }),

    forceChangePassword: builder.mutation<{ message: string }, { new_password: string }>({
      query: (body) => ({ url: '/auth/force-change-password/', method: 'POST', body }),
    }),



    forgotPassword: builder.mutation<
      { message: string },
      { email: string }
    >({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body,
      }),
    }),
    
    resetPassword: builder.mutation<
      { message: string },
      { email: string; code: string; new_password: string }
    >({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
    }),


    // Lister les tâches (paramètre optionnel faite=true|false)
    getTachesDirection: builder.query<TacheDirection[], { faite?: boolean } | void>({
      query: (params) => {
        const search = params?.faite !== undefined ? `?faite=${params.faite}` : ''
        return `taches-direction/${search}`
      },
      providesTags: ['TachesDirection'],
    }),
    
    // Créer une tâche (direction seulement)
    createTacheDirection: builder.mutation<TacheDirection, TacheDirectionPayload>({
      query: (body) => ({
        url: 'taches-direction/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['TachesDirection'],
    }),
    
    // Mettre à jour une tâche
    updateTacheDirection: builder.mutation<
      TacheDirection,
      { id: string } & Partial<TacheDirectionPayload>
    >({
      query: ({ id, ...body }) => ({
        url: `taches-direction/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['TachesDirection'],
    }),
    
    // Supprimer une tâche
    deleteTacheDirection: builder.mutation<void, string>({
      query: (id) => ({
        url: `taches-direction/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TachesDirection'],
    }),
    
    // Marquer faite / non faite
    marquerTacheFaite: builder.mutation<
      TacheDirection,
      { id: string } & MarquerFaitePayload
    >({
      query: ({ id, ...body }) => ({
        url: `taches-direction/${id}/marquer-faite/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['TachesDirection'],
    }),
    
    // Lister les admins assignables (direction seulement)
    getAdminsAssignables: builder.query<AdminUser[], void>({
      query: () => 'taches-direction/admins-assignables/',
      providesTags: ['AdminsAssignables'],
    }),


    // Élèves d'une classe (select dynamique formulaire diplôme)
    getElevesByClasse: builder.query<EleveOption[], string>({
      query: (classeId) => `classes/${classeId}/eleves/`,
      providesTags: (_result, _err, classeId) => [
        { type: 'ElevesClasse', id: classeId },
      ],
    }),

    // Liste des diplômes (optionnel, si tu veux un historique)
    getDiplomes: builder.query<Diplome[], { classe_id?: string; eleve_id?: string }>({
      query: (params) => ({
        url: 'diplomes/',
        params,
      }),
      providesTags: ['Diplomes'],
    }),

    // Créer un diplôme
    createDiplome: builder.mutation({
      query: (formData: FormData) => ({
        url: '/diplomes/',
        method: 'POST',
        body: formData,
        // Ne pas mettre Content-Type, le browser le fait automatiquement
        // avec le boundary pour multipart
      }),
      invalidatesTags: ['Diplomes'],
    }),

    // Modifier un diplôme (optionnel)
    updateDiplome: builder.mutation<Diplome, { id: string } & Partial<CreateDiplomePayload>>({
      query: ({ id, ...body }) => ({
        url: `diplomes/${id}/`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Diplomes'],
    }),


    // ─── Endpoints annonces ──────────────────────────────────────────────────────
 
    getAnnoncesGroupe: builder.query<AnnoncesGroupe[], void>({
      query: () => 'annonces-groupe/',
      transformResponse: (res: any) => res?.results ?? res,
      providesTags: ['AnnoncesGroupe'],
    }),
    
    getAnnoncesGroupeDetail: builder.query<AnnoncesGroupe, string>({
      query: (id) => `annonces-groupe/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'AnnoncesGroupe', id }],
    }),
    
    createAnnoncesGroupe: builder.mutation<AnnoncesGroupe, FormData>({
      query: (body) => ({
        url: 'annonces-groupe/',
        method: 'POST',
        body,
        // Ne pas forcer Content-Type : le browser le met avec le boundary multipart
        formData: true,
      }),
      invalidatesTags: ['AnnoncesGroupe'],
    }),
    
    deleteAnnoncesGroupe: builder.mutation<void, string>({
      query: (id) => ({
        url: `annonces-groupe/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AnnoncesGroupe'],
    }),
    
    getClassesAssignables: builder.query<ClasseSimple[], void>({
      query: () => 'annonces-groupe/classes/',
      providesTags: ['AnnoncesGroupe'],
    }),
    
    getElevesParClasse: builder.query<EleveSimple[], string>({
      query: (classeId) => `annonces-groupe/eleves-par-classe/${classeId}/`,
    }),
    
    // ─── Endpoints élève ──────────────────────────────────────────────────────────
    
    getMesAnnonces: builder.query<AnnonceEleve[], void>({
      query: () => 'mes-annonces/',
      transformResponse: (res: any) => res?.results ?? res,
      providesTags: ['MesAnnonces'],
    }),
    
    marquerAnnonceLue: builder.mutation<{ statut: boolean }, string>({
      query: (id) => ({
        url: `mes-annonces/${id}/lire/`,
        method: 'POST',
      }),
      invalidatesTags: ['MesAnnonces'],
    }),

    // ==================== DASHBOARDS ====================
    
    getEleveDashboard: builder.query<DashboardEleve, void>({
      query: () => '/dashboards/eleve/',
      providesTags: ['Classes', 'Notifications'],
    }),

    getDirectionDashboard: builder.query<DirectionDashboardData, Record<string, string>>({
      query: (params) => ({
        url: 'direction/dashboard/',
        params,
      }),
      providesTags: ['DirectionDashboard'],
    }),

    
    getProfesseurs: builder.query<ProfesseurOption[], void>({
      query: () => '/direction/professeurs/',
    }),
    getClassesDash: builder.query<ClasseOption[], void>({
      query: () => '/direction/classes/',
    }),

    // ==================== CLASSES ====================
    
    /* getClasses: builder.query<PaginatedResponse<Class>, { page?: number; search?: string; professeur_id?: string }>({
      query: (params) => ({
        url: '/classes/',
        params: { page: params.page || 1, search: params.search, professeur_id: params.professeur_id },
      }),
      providesTags: (result) => 
        result 
          ? [...result.results.map(({ id }) => ({ type: 'Classes' as const, id })), 'Classes']
          : ['Classes'],
    }), */




    // ─────────────────────────────────────────────────────────────────────
// À AJOUTER dans ton apiSlice (endpoints existants)
// ─────────────────────────────────────────────────────────────────────

// CLASSES
getClasses: builder.query<
  { results: Class[] },
  { professeur_id?: string; include_deleted?: boolean; statut?: string }
>({
  query: ({ professeur_id, include_deleted, statut }) => ({
    url: 'classes/',
    params: {
      ...(professeur_id ? { professeur_id } : {}),
      ...(include_deleted ? { include_deleted: 'true' } : {}),
      ...(statut ? { statut } : {}),
    },
  }),
  providesTags: ['Classes'],
}),

createClass: builder.mutation<Class, Partial<Class>>({
  query: (body) => ({ url: 'classes/', method: 'POST', body }),
  invalidatesTags: ['Classes'],
}),

updateClass: builder.mutation<Class, { id: string } & Partial<Class>>({
  query: ({ id, ...body }) => ({ url: `classes/${id}/`, method: 'PATCH', body }),
  invalidatesTags: ['Classes'],
}),

// INSCRIPTIONS
getInscriptions: builder.query<{ results: Inscription[] }, { classe?: string }>({
  query: ({ classe }) => ({
    url: 'inscriptions/',
    params: classe ? { classe } : {},
  }),
  providesTags: ['Inscriptions'],
}),

createInscription: builder.mutation<Inscription, { eleve: string; classe: string }>({
  query: (body) => ({ url: 'inscriptions/', method: 'POST', body }),
  invalidatesTags: ['Inscriptions', 'Classes'],
}),

deleteInscription: builder.mutation<void, string>({
  query: (id) => ({ url: `inscriptions/${id}/`, method: 'DELETE' }),
  invalidatesTags: ['Inscriptions', 'Classes'],
}),

// ÉLÈVES DISPONIBLES (pour le dropdown de recherche)
// endpoint : GET /users/?role=eleve&search=...&exclude_classe=...
// (tu peux ajouter exclude_classe côté Django dans UserViewSet.get_queryset)
getAvailableEleves: builder.query<User[], { search?: string; exclude_classe?: string }>({
  query: ({ search, exclude_classe }) => ({
    url: 'users/',
    params: {
      role: 'eleve',
      search: search || undefined,
      exclude_classe: exclude_classe || undefined,
    },
  }),
  // Transformer si ton endpoint retourne { results: [...] }
  transformResponse: (response: { results: User[] } | User[]) =>
    Array.isArray(response) ? response : response.results,
}),

// ─────────────────────────────────────────────────────────────────────
// Tags à ajouter dans tagTypes: [..., 'Classes', 'Inscriptions']
// Hooks à exporter :
//   useGetClassesQuery, useCreateClassMutation, useUpdateClassMutation,
//   useGetInscriptionsQuery, useCreateInscriptionMutation, useDeleteInscriptionMutation,
//   useGetAvailableElevesQuery
// ─────────────────────────────────────────────────────────────────────

    
    getClass: builder.query<Class, string>({
      query: (id) => `/classes/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Classes', id }],
    }),

    /* // ✅ NOUVEAU : Mise à jour d'une classe (édition inline)
    updateClass: builder.mutation<Class, Partial<Class> & { id: string }>({
      query: ({ id, ...changes }) => ({
        url: `/classes/${id}/`,
        method: 'PATCH',
        body: changes,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Classes', id },
        'Classes'
      ],
    }), */

    pauseClass: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/classes/${id}/pause/`, method: 'POST' }),
      invalidatesTags: (result, error, id) => [{ type: 'Classes', id }, 'Classes'],
    }),

    flagDeleteClass: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/classes/${id}/flag-delete/`, method: 'POST' }),
      invalidatesTags: (result, error, id) => [{ type: 'Classes', id }, 'Classes'],
    }),

    reactivateClass: builder.mutation<void, string>({
      query: (id) => ({ url: `classes/${id}/reactivate/`, method: 'POST' }),
      invalidatesTags: ['Classes'],
    }),
    
    deleteClass: builder.mutation<void, string>({
      query: (id) => ({ url: `classes/${id}/delete-permanently/`, method: 'DELETE' }),
      invalidatesTags: ['Classes'],
    }),


// GET /api/factures/{id}/detail-seances/
getFactureDetailSeances: builder.query<FactureDetailSeances, string>({
  query: (factureId) => `/factures-emises/${factureId}/detail-seances/`,
}),
 
// POST /api/factures/{id}/submit/
submitFacture: builder.mutation<
  { detail: string; facture_eleves: FactureEleveItem[] },
  SubmitFacturePayload
>({
  query: ({ facture_id, ...body }) => ({
    url: `/factures-emises/${facture_id}/submit/`,
    method: 'POST',
    body,
  }),
  invalidatesTags: ['Factures'],   // adapte selon tes tags existants
}),



// Presences facturables d'un prof (vue admin)
getAdminFacturePresences: builder.query<PresenceFacturable[], string>({
  query: (professeur_id) => ({
    url: 'admin/prof-facture-presences/',
    params: { professeur_id },
  }),
  providesTags: ['Factures'],
}),

// Factures émises d'un prof (vue admin)
getAdminFacturesEmises: builder.query<PaginatedResponse<Facture>, { professeur_id: string; page?: number }>({
  query: ({ professeur_id, page = 1 }) => ({
    url: 'admin/factures/',
    params: { professeur_id, page },
  }),
  providesTags: ['Factures'],
}),

// Preview facture (vue admin — professeur_id dans le body)
previewAdminFacture: builder.mutation<FacturePreview, {
  professeur_id: string;
  classe_id: string;
  date_debut: string;
  date_fin: string;
}>({
  query: (body) => ({
    url: 'admin/factures/preview/',
    method: 'POST',
    body,
  }),
}),

    // ==================== SÉANCES ====================
 
    // GET /classes/<classId>/seances/
    getClassSeances: builder.query<PaginatedResponse<Seance>, string>({
      query: (classId) => `/classes/${classId}/seances/`,
      providesTags: (result, error, classId) =>
        result
          ? [...result.results.map(({ id }) => ({ type: 'Seances' as const, id })), { type: 'Seances', id: classId }]
          : [{ type: 'Seances', id: classId }],
    }),
 
    // POST /seances/
    createSeance: builder.mutation<Seance, {
      classe: string 
      date_seance?: string | null  // ← après
      jour_seance?: string | null  // ← ajouter si absent
      heure_debut_reelle?: string | null
      duree_reelle_minutes?: number | null
      statut?: string | null
    }>({
      query: (body) => ({
        url: '/seances/',
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { classe }) => [
        { type: 'Seances', id: classe },
        'Seances',
      ],
    }),
 
    // PATCH /seances/<id>/
    updateSeance: builder.mutation<Seance, Partial<Seance> & { id: string }>({
      query: ({ id, ...changes }) => ({
        url: `/seances/${id}/`,
        method: 'PATCH',
        body: changes,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Seances', id },
        'Seances',
      ],
    }),


    updatePlanningItem: builder.mutation<void, UpdateSeancePayload>({
      query: ({ id, ...body }) => ({
        url: `planning/${id}/update/`,
        method: 'PATCH',
        body,
      }),
      // Invalider le cache planning après mise à jour
      invalidatesTags: ['Planning'],
    }),

    createSeanceDispo: builder.mutation<void, CreateSeancePayload>({
      query: (body) => ({
        url: 'planning/create/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Planning'],
    }),

    
    getSeanceJour: builder.query<SeancesToday[], void>({
      query: () => '/seanceJour/today/',
      transformResponse: (response: any) => response,
    }),

    // ==================== INSCRIPTIONS / ÉLÈVES ====================
    
    // ✅ NOUVEAU : Récupérer les élèves d'une classe
    getClassStudents: builder.query<PaginatedResponse<Inscription>, string>({
      query: (classId) => `/inscriptions/?classe=${classId}`,
      providesTags: (result, error, classId) => 
        result ? [{ type: 'Inscriptions', id: classId }, 'Inscriptions'] : ['Inscriptions'],
    }),

    // ✅ NOUVEAU : Mise à jour d'un utilisateur (nom élève)
    updateStudent: builder.mutation<User, Partial<User> & { id: string }>({
      query: ({ id, ...changes }) => ({
        url: `/users/${id}/`,
        method: 'PATCH',
        body: changes,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Users', id },
        'Users',
        'Inscriptions'
      ],
    }),

    // ==================== MESSAGES ====================
    
    getClassMessages: builder.query<PaginatedResponse<Message>, { classeId: string; page?: number }>({
      query: ({ classeId, page }) => ({
        url: '/messages/',
        params: { classe_id: classeId, page: page || 1 },
      }),
      providesTags: (result) => 
        result 
          ? [...result.results.map(({ id }) => ({ type: 'Messages' as const, id })), 'Messages']
          : ['Messages'],
    }),

    sendMessage: builder.mutation<Message, { classe_id: string; contenu: string; type_message?: string }>({
      query: (body) => ({ url: '/messages/', method: 'POST', body }),
      invalidatesTags: ['Messages'],
    }),

    getPrivateMessages: builder.query<PaginatedResponse<PrivateMessage>, { page?: number }>({
      query: (params) => ({ url: '/messages-prives/', params }),
      providesTags: ['Messages'],
    }),

    sendPrivateMessage: builder.mutation<PrivateMessage, { destinataire: string; contenu: string }>({
      query: (body) => ({ url: '/messages-prives/', method: 'POST', body }),
      invalidatesTags: ['Messages'],
    }),

    // ==================== DEVOIRS & FACTURES ====================
    
    getDevoirs: builder.query<PaginatedResponse<Devoir>, { page?: number; statut?: string }>({
      query: (params) => ({ url: '/devoirs/', params }),
      providesTags: ['Devoirs'],
    }),

    getFactures: builder.query<PaginatedResponse<Facture>, { page?: number }>({
      query: (params) => ({ url: '/factures/', params }),
      providesTags: ['Factures'],
    }),

    getProfStats: builder.query<ProfDashboardStats, void>({
      query: () => 'factures-emises/stats/',
      providesTags: ['FacturesEmises', 'Classes', 'Inscriptions'],
    }),

    getEleveStats: builder.query<EleveDashboardStats, void>({
      query: () => 'factures-eleve/stats/',
      providesTags: ['FacturesEleve', 'Classes', 'Inscriptions'],
    }),

    
    getProfFacturePresences: builder.query<PresenceFacturable[], void>({
      query: () => '/prof-facture-presences/',
      transformResponse: (response: any) => {
        // Gère les deux cas : liste directe ou paginé { results: [...] }
        return Array.isArray(response) ? response : (response.results ?? [])
      },
      providesTags: ['PresencesFacturables'],
    }),


    getAdminElevesAPayer: builder.query<AdminEleveAPayer[], void>({
      query: () => 'admin-dashboard/eleves-a-payer/',
    }),

    // ── Factures ────────────────────────────────────────────────
 
    getFacturesEmises: builder.query<PaginatedResponse<Facture>, { page?: number }>({
      query: ({ page = 1 }) => `/factures-emises/?page=${page}`,
      providesTags: ['FacturesEmises'],
    }),
  
    getFacture: builder.query<Facture, string>({
      query: (id) => `/factures-emises/${id}/`,
      providesTags: (_r, _e, id) => [{ type: 'FacturesEmises', id }],
    }),
  
    createFacture: builder.mutation<Facture, FactureCreatePayload>({
      query: (body) => ({ url: '/factures-emises/', method: 'POST', body }),
      invalidatesTags: ['FacturesEmises'],
    }),
  
    previewFacture: builder.mutation<FacturePreview, FactureCreatePayload>({
      query: (body) => ({ url: '/factures-emises/preview/', method: 'POST', body }),
    }),
  
    sendFactureReminder: builder.mutation<{ detail: string }, string>({
      query: (id) => ({ url: `/factures-emises/${id}/remind/`, method: 'POST' }),
      invalidatesTags: ['FacturesEmises'],
    }),

    // ==================== Suivi Presence====================

    getSuiviPresences: builder.query<SuiviPresence[], void>({
      query: () => '/suivi-presences/',
      transformResponse: (response: any) => {
        // Gère les deux cas : liste directe ou paginé { results: [...] }
        return Array.isArray(response) ? response : (response.results ?? [])
      },
      providesTags: ['SuiviPresences'],
    }),

    // ==================== Facture admin ====================

    getFacturesAdmin: builder.query<FactureAdmin[], void>({
      query: () => '/admin/factures/',
      providesTags: ['FactureAdmin'],
    }),

    validerFacture: builder.mutation<FactureAdmin, string>({
      query: (id) => ({
        url: `/admin/factures/${id}/valider/`,
        method: 'POST',
      }),
      invalidatesTags: ['FactureAdmin'],
    }),


    getFacturesEleve: builder.query<PaginatedFactureEleve, { page?: number }>({
      query: ({ page = 1 } = {}) => `factures-eleve/?page=${page}`,
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'FactureEleve' as const, id })),
              { type: 'FactureEleve', id: 'LIST' },
            ]
          : [{ type: 'FactureEleve', id: 'LIST' }],
    }),
    
    // POST /api/factures-eleve/{id}/payer/
    payerFactureEleve: builder.mutation<FactureElevePayeItem, PayerPayload>({
      query: ({ facture_eleve_id, montant_payer }) => ({
        url: `factures-eleve/${facture_eleve_id}/payer/`,
        method: 'POST',
        body: { montant_payer },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'FactureEleve', id: arg.facture_eleve_id },
        { type: 'FactureEleve', id: 'LIST' },
      ],
    }),
    


    // Récupère les FactureEleve d'une facture spécifique (panel prof)
    getFactureEleveByFacture: builder.query<FactureElevePayeItem[], string>({
      query: (factureId) => `factures-eleve/?facture_id=${factureId}`,
      transformResponse: (response: any) =>
        // gère pagination ou liste directe
        Array.isArray(response) ? response : response.results ?? [],
      providesTags: (_r, _e, factureId) => [
        { type: 'FactureEleve', id: factureId },
        { type: 'FactureEleve', id: 'LIST' },
      ],
    }),
    
    // POST /api/factures-eleve/{id}/confirmer/
    // Confirme 1 paiement individuel
    confirmerFactureEleve: builder.mutation<FactureElevePayeItem, string>({
      query: (factureEleveId) => ({
        url: `factures-eleve/${factureEleveId}/confirmer/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'FactureEleve', id },
        { type: 'FactureEleve', id: 'LIST' },
        { type: 'Factures',     id: 'LIST' },
      ],
    }),
    
    // POST /api/factures-eleve/confirmer-tout/
    // Confirme tous les paiements payés d'une facture en une fois
    confirmerToutFactureEleve: builder.mutation<
      { detail: string; count: number },
      { facture_id: string }
    >({
      query: (body) => ({
        url: `factures-eleve/confirmer-tout/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'FactureEleve', id: 'LIST' },
        { type: 'Factures',     id: 'LIST' },
      ],
    }),
 
    //diplomes eleves
    getMyDiplomes: builder.query<Diplome[], void>({
      query: () => '/mes-diplomes/',
      transformResponse: (response: { count: number; results: Diplome[] }) => response.results,
    }),

    // GET /api/factures-eleve/classes-list/
    getClassesList: builder.query<ClasseLight[], void>({
      query: () => 'factures-eleve/classes-list/',
      providesTags: [{ type: 'ClasseLight', id: 'LIST' }],
    }),
 
    // POST /api/factures-eleve/  (multipart/form-data)
    createFactureEleve: builder.mutation<FactureEleve, FormData>({
      query: (formData) => ({
        url: 'factures-eleve/',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: [{ type: 'FactureEleve', id: 'LIST' }],
    }),
 
    // PATCH /api/factures-eleve/{id}/marquer-paye/  (admin)
    marquerPayeFacture: builder.mutation<FactureEleve, string>({
      query: (id) => ({
        url: `factures-eleve/${id}/marquer-paye/`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'FactureEleve', id }],
    }),
 
    // DELETE /api/factures-eleve/{id}/  (admin)
    deleteFactureEleve: builder.mutation<void, string>({
      query: (id) => ({
        url: `factures-eleve/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'FactureEleve', id: 'LIST' }],
    }),


    // ✅ CORRECT : correspond à @action(url_path='preview/participants')
    getFactureParticipants: builder.query<FactureParticipant[], {
      classe_id: string;
      date_debut: string;
      date_fin: string;
    }>({
      query: (params) => ({
        url: 'factures-emises/preview/participants/',  // ← URL exacte
        method: 'POST',
        body: params,
      }),
      providesTags: ['AbsencesProfs'],
    }),
    
    // ✅ CORRECT : correspond à @action(url_path='participants/payment')
    updateParticipantsPayment: builder.mutation<void, ParticipantsPaymentPayload>({
      query: (payload) => ({
        url: `factures-emises/${payload.facture_id}/participants/payment/`,  // ← URL exacte
        method: 'POST',
        body: {
          payeur_id: payload.payeur_id,
          participants: payload.participants,
        },
      }),
      invalidatesTags: ['AbsencesProfs', 'Factures'],
    }),



    // ==================== PLANNING & NOTIFICATIONS ====================
    
    getPlanningdemo: builder.query<PlanningDispo[], { professeur_id?: string }>({
      query: (params) => ({ url: '/planning-dispos/', params }),
    }),

    getNotifications: builder.query<PaginatedResponse<Notification>, { page?: number; lu?: boolean }>({
      query: (params) => ({ url: '/notifications/', params }),
      providesTags: ['Notifications'],
    }),

    markNotificationRead: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/notifications/${id}/mark_read/`, method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),



  // ── Devoirs d'une classe ───────────────────────────────────────────────────────

  getClassDevoirs: builder.query<{ results: Devoir[] }, string>({
    query: (classeId) => `/gestion-devoirs/?classe_id=${classeId}`,
    providesTags: (result, _err, classeId) =>
      result
        ? [
            ...result.results.map(d => ({ type: 'Devoir' as const, id: d.id })),
            { type: 'Devoir', id: `LIST-${classeId}` },
          ]
        : [{ type: 'Devoir', id: `LIST-${classeId}` }],
  }),
 
  // ── Élèves ayant participé à un devoir ─────────────────────────────────────
  getDevoirEleves: builder.query<EleveDevoir[], string>({
    query: (devoirId) => `/gestion-devoirs/${devoirId}/eleves/`,
    providesTags: (_r, _e, id) => [{ type: 'DevoirEleve', id }],
  }),
 
  // ── Passer le devoir en corrigé ────────────────────────────────────────────
  corrigerDevoir: builder.mutation<Devoir, string>({
    query: (devoirId) => ({
      url: `/gestion-devoirs/${devoirId}/corriger/`,
      method: 'PATCH',
    }),
    invalidatesTags: (_r, _e, id) => [{ type: 'Devoir', id }],
  }),
 
  // ── Mettre à jour la note d'un élève ──────────────────────────────────────
  noterEleve: builder.mutation<
    { absence_id: string; note: string },
    { devoirId: string; absence_id: string; note: string }
  >({
    query: ({ devoirId, ...body }) => ({
      url: `/gestion-devoirs/${devoirId}/noter/`,
      method: 'PATCH',
      body,
    }),
    invalidatesTags: (_r, _e, { devoirId }) => [{ type: 'DevoirEleve', id: devoirId }],
  }),
 
  // ── Upload fichier corrigé par le prof ─────────────────────────────────────
  uploadCorrectionProf: builder.mutation<
    { uploaded: any[] },
    { devoirId: string; eleveId: string; files: File[] }
  >({
    query: ({ devoirId, eleveId, files }) => {
      const formData = new FormData()
      formData.append('eleve_id', eleveId)
      files.forEach(f => formData.append('files', f))
      return {
        url: `/gestion-devoirs/${devoirId}/upload-correction/`,
        method: 'POST',
        body: formData,
      }
    },
    invalidatesTags: (_r, _e, { devoirId }) => [{ type: 'DevoirEleve', id: devoirId }],
  }),


  //planning
  getPlanning: builder.query<PlanningResponse, PlanningFilters>({
      query: (filters) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value.toString());
        });
        return `planning/?${params.toString()}`;
      },
      providesTags: ['Planning'],
    }),
    
    // 🔍 Détail d'une séance (pour modal info)
    getPlanningItem: builder.query<PlanningItem, string>({
      query: (id) => `planning/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Planning', id }],
    }),
    
    // 📊 Stats pour dashboard (lecture seule)
    getPlanningStats: builder.query<{
      total_seances: number;
      completed: number;
      in_progress: number;
      absent: number;
      retard_moyen: number;
    }, void>({
      query: () => 'planning/stats/',
    }),


    // ── CatalogueCours ──────────────────────────────────────
 
    getCatalogueCours: builder.query<PaginatedCours, GetCoursParams>({
      query: ({ search, page = 1 } = {}) => ({
        url: 'catalogue-cours/',
        params: {
          ...(search ? { search } : {}),
          page,
        },
      }),
      providesTags: ['CatalogueCours'],
    }),
 
    createCours: builder.mutation<Cours, Omit<Cours, 'id' | 'created_at'>>({
      query: (body) => ({
        url: 'catalogue-cours/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['CatalogueCours'],
    }),
 
    updateCours: builder.mutation<Cours, Partial<Cours> & Pick<Cours, 'id'>>({
      query: ({ id, ...patch }) => ({
        url: `catalogue-cours/${id}/`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: ['CatalogueCours'],
    }),
 
    deleteCours: builder.mutation<void, string>({
      query: (id) => ({
        url: `catalogue-cours/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CatalogueCours'],
    }),



    getAbsences: builder.query<PaginatedAbsences, AbsenceFilters>({
    query: (params = {}) => ({
      url: 'absences/',
      params,
    }),
    providesTags: ['Absence'],
  }),
 
  createAbsence: builder.mutation<AbsenceSignaler, {
    seance: string;
    date_absence: string;
    remarque?: string;
  }>({
    query: (body) => ({
      url: 'absences/create/',
      method: 'POST',
      body,
    }),
    invalidatesTags: ['Absence'],
  }),
 
  deleteAbsence: builder.mutation<void, string>({
    query: (id) => ({
      url: `absences/${id}/supprimer/`,
      method: 'DELETE',
    }),
    invalidatesTags: ['Absence'],
  }),



    getAdminAbsenceCalendar: builder.query<AdminCalendarResponse, {
      professeur_id: string;
      year:  number;
      month: number;
    }>({
      query: (p) => ({
        url: 'absences/admin-calendar/',
        params: p,
      }),
      providesTags: ['Absence'],
    }),
  
    signalerAbsence: builder.mutation<AbsenceSignaler, {
      seance_id:    string;
      date_absence: string;
    }>({
      query: (body) => ({
        url: 'absences/signaler/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Absence'],
    }),
  
    revoquerAbsence: builder.mutation<{ id: string; statut: string }, string>({
      query: (id) => ({
        url: `absences/${id}/revoquer/`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Absence'],
    }),
 


    // ==================== UTILISATEURS (Direction/Admin) ====================
    
    getUsers: builder.query<
      PaginatedResponse<User>,
      { role?: string; page?: number; search?: string; is_active?: boolean }
    >({
      query: (params) => ({ url: '/users/', params }),
      providesTags: ['Users'],
    }),

    reactivateUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/users/${id}/reactivate/`,
        method: 'POST',
      }),
      invalidatesTags: ['Users'],
    }),

    // ✅ NOUVEAU : Récupérer la liste des admins disponibles (pour dropdown)
    getAvailableAdmins: builder.query<User[], void>({
      query: () => '/users/admins/',  // ← Utilise l'@action ci-dessus
      providesTags: ['Users'],
    }),

    createUser: builder.mutation<{ message: string; user_id: string }, {
      email: string
      role: string
      display_name?: string
      nom_complet?: string
      nom_diplome?: string
      code_prof?: string
    }>({
      query: (body) => ({ url: '/users/create_account/', method: 'POST', body }),
      invalidatesTags: ['Users'],
    }),

    // ✅ NOUVEAU : Mise à jour d'un utilisateur (réutilise updateStudent ou crée un générique)
    updateUser: builder.mutation<User, Partial<User> & { id: string }>({
      query: ({ id, ...changes }) => ({
        url: `/users/${id}/`,
        method: 'PATCH',
        body: changes,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Users', id },
        'Users'
      ],
    }),

    getUser: builder.query<User, string>({
      query: (id) => `/users/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Users', id }],
    }),

    resetUserPassword: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/${id}/reset_password/`, method: 'POST' }),
    }),


    // ── GET /api/presences/prof/?seance_id=<uuid> ─────────────────────────────
    getPresenceProf: builder.query<PresenceProf | null, string>({
      query: (seanceId: string) => ({
        url: 'presences/prof/',
        params: { seance_id: seanceId },
      }),
      providesTags: (_result: any, _error: any, seanceId: string) => [
        { type: 'PresenceProf', id: seanceId },
      ],
    }),
  
    // ── PATCH /api/presences/prof/<id>/ ──────────────────────────────────────
    updatePresenceProf: builder.mutation<
      PresenceProf,
      { presenceId: string; seanceId: string; data: Partial<Pick<PresenceProf, 'heure_connexion_prof' | 'temps_prof'>> }
    >({
      query: ({ presenceId, data }: { presenceId: string; data: any }) => ({
        url: `presences/prof/${presenceId}/`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result: any, _error: any, { seanceId }: { seanceId: string }) => [
        { type: 'PresenceProf', id: seanceId },
      ],
    }),
  
    // ── GET /api/absences-eleves/?seance_id=<uuid> ───────────────────────────
    getAbsencesEleves: builder.query<AbsenceEleveRow[], string>({
      query: (seanceId: string) => ({
        url: 'absences-eleves/',
        params: { seance_id: seanceId },
      }),
      providesTags: (_result: any, _error: any, seanceId: string) => [
        { type: 'AbsenceEleve', id: seanceId },
      ],
    }),
  
    // ── PATCH /api/absences-eleves/<id>/ ─────────────────────────────────────
    updateAbsenceEleve: builder.mutation<
      AbsenceEleveRow,
      { absenceId: string; seanceId: string; data: Partial<Pick<AbsenceEleveRow, 'temps_effectif' | 'durree_eleve'>> }
    >({
      query: ({ absenceId, data }: { absenceId: string; data: any }) => ({
        url: `absences-eleves/${absenceId}/`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result: any, _error: any, { seanceId }: { seanceId: string }) => [
        { type: 'AbsenceEleve', id: seanceId },
      ],
    }),


  }),
})

// 🔹 Hooks exportés (à importer dans tes composants)
export const {
  useLoginMutation,
  useChangePasswordMutation,
  useForceChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetEleveDashboardQuery,
  useGetClassesQuery,
  useGetClassQuery,
  useUpdateClassMutation,        // ✅ Nouveau
  usePauseClassMutation,
  useFlagDeleteClassMutation,
  useGetClassStudentsQuery,      // ✅ Nouveau
  useUpdateStudentMutation,      // ✅ Nouveau
  useGetClassMessagesQuery,
  useSendMessageMutation,
  useGetPrivateMessagesQuery,
  useSendPrivateMessageMutation,
  useGetDevoirsQuery,
  useGetFacturesQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useResetUserPasswordMutation,
  useGetAvailableAdminsQuery,  // ✅ Nouveau
  useUpdateUserMutation,       // ✅ Nouveau (ou réutilise useUpdateStudentMutation)
  useGetUserQuery,
  // ✅ Séances
  useGetClassSeancesQuery,
  useCreateSeanceMutation,
  useUpdateSeanceMutation,

  useGetClassDevoirsQuery,
  useGetDevoirElevesQuery,
  useCorrigerDevoirMutation,
  useNoterEleveMutation,
  useUploadCorrectionProfMutation,
  useGetCatalogueCoursQuery,
  useCreateCoursMutation,
  useUpdateCoursMutation,
  useDeleteCoursMutation,
  useGetProfFacturePresencesQuery,
  useGetSuiviPresencesQuery,
  useGetFacturesEmisesQuery,
  useGetFactureQuery,
  useCreateFactureMutation,
  usePreviewFactureMutation,
  useSendFactureReminderMutation,
  useGetFacturesAdminQuery,
  useValiderFactureMutation,
  useGetFacturesEleveQuery,
  useCreateFactureEleveMutation,
  useMarquerPayeFactureMutation,
  useDeleteFactureEleveMutation,
  useGetClassesListQuery,
  useLazyGetFactureParticipantsQuery,
  useUpdateParticipantsPaymentMutation,
  useGetDirectionDashboardQuery,
  useGetProfesseursQuery,
  useGetClassesDashQuery,
  useGetPlanningQuery, 
  useGetPlanningItemQuery,
  useGetPlanningStatsQuery,
  useReactivateUserMutation,
  useCreateClassMutation,
  useGetInscriptionsQuery, useCreateInscriptionMutation, useDeleteInscriptionMutation,
  useGetAvailableElevesQuery ,
  useGetSeanceJourQuery,
  useUpdatePlanningItemMutation,
  useCreateSeanceDispoMutation,
  useReactivateClassMutation,
  useLazyGetFactureDetailSeancesQuery,
  useSubmitFactureMutation,
  usePayerFactureEleveMutation,
  useConfirmerFactureEleveMutation,
  useGetFactureEleveByFactureQuery,
  useConfirmerToutFactureEleveMutation,
  useGetAbsencesQuery,
  useCreateAbsenceMutation,
  useDeleteAbsenceMutation,
  useGetAdminAbsenceCalendarQuery,
  useSignalerAbsenceMutation,
  useRevoquerAbsenceMutation,
  useDeleteClassMutation,
  useGetAdminFacturesEmisesQuery,
  useGetAdminFacturePresencesQuery,
  usePreviewAdminFactureMutation,
  useGetTachesDirectionQuery,
  useCreateTacheDirectionMutation,
  useUpdateTacheDirectionMutation,
  useDeleteTacheDirectionMutation,
  useMarquerTacheFaiteMutation,
  useGetAdminsAssignablesQuery,
  useGetAnnoncesGroupeQuery,
  useGetAnnoncesGroupeDetailQuery,
  useCreateAnnoncesGroupeMutation,
  useDeleteAnnoncesGroupeMutation,
  useGetClassesAssignablesQuery,
  useGetElevesParClasseQuery,
  useGetMesAnnoncesQuery,
  useMarquerAnnonceLueMutation,
  useGetProfStatsQuery,
  useGetEleveStatsQuery,
  useGetElevesByClasseQuery,
  useGetDiplomesQuery,
  useCreateDiplomeMutation,
  useUpdateDiplomeMutation,
  useGetMyDiplomesQuery,
  useGetAdminElevesAPayerQuery 
} = apiSlice
