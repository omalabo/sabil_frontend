/**
 * 🎯 Types TypeScript correspondant aux serializers Django DRF
 * Typage fort pour : sécurité, auto-complétion, détection d'erreurs à la compilation
 */

// ==================== AUTH & UTILISATEURS ====================

export type UserRole = 'eleve' | 'professeur' | 'admin' | 'direction'
export type DevoirStatut = 'brouillon' | 'soumis' | 'cloturer' | 'corrige'
export interface User {
  id: string
  email: string
  display_name: string
  nom_diplome?: string
  role: UserRole
  must_change_password: boolean
  first_login_done: boolean
  is_active: boolean
  created_at: string
  // ✅ Nouveaux champs pour la gestion admin
  admin_id?: string | null      // ID de l'admin assigné (UUID)
  admin_nom?: string            // Nom de l'admin (lu via serializer, read-only)
  updated_at?: string
  [key: string]: any // Pour flexibilité avec champs dynamiques
  code_prof?: string
  homme_femme?: string
  telephone: string
  indicatif: string
}

// types/index.ts — ajouter ces types dans ton fichier types existant


export interface AdminEleveAPayer {
  facture_eleve_id: string
  eleve_id: string
  eleve_nom: string
  eleve_is_active: boolean
  telephone: string
  classe_id: string
  classe_nom: string
  cours: string
  professeur_id: string
  professeur_nom: string
  montant_a_payer: number
  statut: string
}

export interface Diplome {
  id: string
  eleve: string           // UUID
  eleve_nom: string       // via serializer
  classe: string          // UUID
  classe_nom: string      // via serializer
  professeur: string      // UUID
  professeur_nom: string  // via serializer
  matiere: string
  nom_eleve_diplome: string
  note_orale: string
  note_ecrite: string
  appreciation: string
  delivre_at: string      // YYYY-MM-DD
  created_at: string
}

export interface CreateDiplomePayload {
  eleve: string
  classe: string
  // professeur est injecté côté backend via perform_create
  matiere: string
  nom_eleve_diplome: string
  note_orale?: string
  note_ecrite?: string
  appreciation?: string
  delivre_at?: string
}


export interface LoginResponse {
  message: string
  role: UserRole
  must_change_password: boolean
  token: string
  refresh: string
  user: {
    id: string
    email: string
    display_name: string
    role: UserRole
    must_change_password: boolean
  }
}

export interface PasswordChangeRequest {
  old_password?: string
  new_password: string
}

// ==================== CLASSES ====================

export type ClassStatus = 'active' | 'en_pause' | 'fin_session' | 'supprimer' | 'a_supprimer'
export type ClassColor = 'vert' | 'orange' | 'rouge' | 'blanc'
// ✅ Type cours : détermine la logique tarifaire de la classe
export type TypeCours =
  | 'solo'
  | 'duo'
  | 'trio'
  | 'groupe'
  | 'alphabetisation'
  | 'fluidification'
  | 'groupe_special_3e'
  | 'gratuit'
  | ''

export interface Class {
  id: string
  nom: string
  programme?: string
  niveau?: string
  professeur?: string | User // ID ou objet selon expand
  professeur_nom?: string
  admin?: string | User
  admin_nom?: string
  jour_semaine?: number // 1=Lundi ... 7=Dimanche
  heure_debut?: string // Format "HH:MM:SS"
  duree_minutes?: number
  date_debut_session?: string
  taux_horaire?: string | number
    // ✅ Nouveau champ type_cours
  type_cours?: TypeCours
  statut: ClassStatus
  couleur: ClassColor
  creneau_confirme_prof?: boolean
  derniere_activite_at?: string
  jitsi_room_id?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  nb_inscrits?: number
  [key: string]: any
}

// ==================== INSCRIPTIONS ====================

export interface Inscription {
  id: string
  eleve: string | User      // ID ou objet User si expand
  classe: string | Class    // ID ou objet Class si expand
  eleve_nom?: string        // Nom pré-calculé côté serializer (optionnel)
  classe_nom?: string
  statut_inscription?: string // 'actif', 'en_attente', 'annule'
  date_inscription?: string
  nom_diplome?: string | null
  contrat_signe?: boolean
  contrat_signe_at?: string | null
  contrat_ip?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: any
}




export interface ClasseSimple {
  id: string
  nom: string
  niveau: string | null
  type_cours: string | null
  statut: string
  professeur_nom: string | null
  nb_eleves: number
}

export interface EleveSimple {
  id: string
  display_name: string | null
  email: string
}

export interface AnnonceDestinataire {
  id: string
  eleve: string         // UUID
  eleve_nom: string | null
  eleve_email: string
  statut: boolean       // lu ou non
  created_at: string
}

export interface AnnoncesGroupe {
  id: string
  titre: string | null
  nom_original: string
  nom_stockage: string
  fichier_url: string | null
  type_fichier: string
  mime_type: string | null
  taille_bytes: number | null
  anonce_expired: string
  created_at: string
  nb_destinataires: number
  nb_lus: number
  est_expiree?: boolean
  destinataires?: AnnonceDestinataire[]   // présent uniquement sur retrieve
}

// Payload création (FormData côté React)
export interface AnnoncesGroupePayload {
  titre: string
  anonce_expired: string      // ISO datetime
  eleve_ids: string[]
  fichier_local: File
}

// Ce qu'un élève reçoit
export interface AnnonceEleve {
  id: string
  statut: boolean
  created_at: string
  titre: string | null
  fichier_url: string | null
  type_fichier: string
  mime_type: string | null
  nom_original: string
  anonce_expired: string
  annonce_created_at: string
  est_expiree: boolean
}




// ==================== MESSAGERIE ====================

export type MessageType = 'texte' | 'fichier' | 'image' | 'audio' | 'systeme' | 'annonce'| 'video' | 'image_motivation'
export type CanalType = 'classe' | 'admin' | 'direction'

export interface Message {
  id: string
  expediteur: User | string 
  expediteur_nom?: string
  classe?: Class
  type_canal: CanalType
  type_message: MessageType
  contenu?: string
  fichier?: Fichier
  fichier_url?: string
  nom_fichier?: string
  fichier_expires_at?: string | null
  is_voice_note?: boolean
  is_systeme: boolean
  reply_to?: Message | string
  reply_to_preview?: {
    id: string
    expediteur_nom: string
    type_message: string
    contenu?: string
    nom_fichier?: string
    fichier_url: string | null
  } | null
  recu_par?: string[]
  lu_par_ids?: string[]
  created_at: string
  deleted_at?: string
}

export interface PrivateMessage {
  id: string
  expediteur: User
  destinataire: User
  contenu?: string
  type_message: MessageType
  fichier?: Fichier
  lu: boolean
  lu_at?: string
  created_at: string
}

export interface ProfDashboardStats {
  nb_classes_actives: number
  nb_inscrits: number
  nb_factures_envoyees: number
  nb_factures_payees: number
  montant_total_paye: number
}

export interface EleveDashboardStats {
  nb_classes_actives: number
  programmes: string[]
  montant_a_payer: number
  montant_paye: number
  nb_seances: number
}


export interface AdminUser {
  id: string
  display_name: string | null
  email: string
}

export interface TacheAssignee {
  id: string
  user: string          // UUID
  display_name: string | null
  email: string
  assigned_at: string
}

export interface TacheDirection {
  id: string
  titre: string
  description: string | null
  faite: boolean
  faite_par: string | null       // UUID
  faite_par_name: string | null
  created_by: string | null      // UUID
  created_by_name: string | null
  faite_at: string | null
  created_at: string
  delais: string | null
  assignees: TacheAssignee[]
}

// Payload création / édition
export interface TacheDirectionPayload {
  titre: string
  description?: string
  assignee_ids: string[]
  delais?: string | null
}

// Payload marquer faite
export interface MarquerFaitePayload {
  faite: boolean
}

// ==================== COURS & SÉANCES ====================

export interface Seance {
  id: string
  classe_id: Class
  date_seance?: string | null   
  jour_seance?: string | null    
  heure_debut_reelle?: string
  duree_reelle_minutes?: number
  statut: string
  created_at: string
}

export interface SeancesToday {
  id: string
  classe: string
  classe_nom: string
  classe_id: string
  date_seance: string | null
  jour_seance: string
  heure_debut_reelle: string
  duree_reelle_minutes: number
  statut: string
  created_at: string
}

export interface Presence {
  id: string
  classe: Class
  eleve: User
  seance: Seance
  statut: string
  heure_connexion?: string
  heure_deconnexion?: string
  retard_minutes?: number
  corrige_par_prof: boolean
  created_at: string
}



// ============================================================
// facture eleve
// ============================================================

export interface EleveInscrit {
  eleve_id: string
  eleve_nom: string
  eleve_email: string
  parent_id: string | null
}

// ✅ SeanceDetail enrichi avec les champs tarifaires
export interface SeanceDetail {
  presence_id: string
  seance_id: string
  date_seance: string
  duree_heures: string
  heure_connexion: string | null
  heure_deconnexion: string | null
  participants_ids: string[]
  // ✅ Nouveaux champs tarifaires par séance
  type_cours_effectif: TypeCours
  tarif_eleve_par_personne: string
  total_collecte_seance: string
  part_direction_seance: string
  part_prof_seance: string
}
 
export interface FactureDetailSeances {
  eleves_inscrits: EleveInscrit[]
  seances: SeanceDetail[]
  montant_total: string
  // ✅ Nouveaux champs globaux
  part_direction: string
  part_prof: string
  nb_inscrits: number
  nb_participants_global: number
  type_cours: TypeCours
}

export type SubmitMethode = 'inscrits' | 'participants' | 'manuel'

export interface MontantManuel {
  eleve_id: string
  montant_a_payer: number
}

export interface SubmitFacturePayload {
  facture_id: string
  methode: SubmitMethode
  montants?: MontantManuel[]
}

export interface FactureEleveItem {
  id: string
  eleve_id: string
  eleve_nom: string
  eleve_email: string
  parent_id: string
  date_debut: string
  date_fin: string
  statut: string
  montant_a_payer: string | number
  montant_payer: string | number
  methode_payement: string
  facture_id: string
  created_at: string
}



export interface FactureElevePayeItem {
  id: string
  classe_nom: string
  prof_nom: string
  date_seance: string | null
  presence_id: string
  facture_id: string
  date_debut: string
  date_fin: string
  montant_a_payer: string | number
  montant_payer: string | number
  methode_payement: string
  statut: 'emise' | 'payee' | 'confirmee'
  // calculé côté backend
  statut_paiement: 'a_payer' | 'partiel' | 'paye'
  created_at: string
  // Infos élève
  eleve_nom?: string
  eleve_email?: string
}


export interface PaginatedFactureEleve {
  count: number
  next: string | null
  previous: string | null
  results: FactureElevePayeItem[]
}
 
export interface PayerPayload {
  facture_eleve_id: string
  montant_payer: number
}

// ==================== PÉDAGOGIE ====================

export interface Devoir {
  id: string
  titre: string | null
  statut: DevoirStatut
  created_at: string
  submitted_at: string | null
  corrige_at: string | null
  seance_id: string
  classe_id: string
}

export interface FichierDevoir {
  id: string
  nom_original: string
  nom_stockage: string
  type_fichier: string
  mime_type: string | null
  taille_bytes: number | null
  statut_correction: boolean
  created_at: string
  eleve_id: string | null
}

export interface EleveDevoir {
  absence_id: string
  presence_id: string
  eleve: {
    id: string
    display_name: string
    email: string
  }
  note: string | null
  fichiers_eleve: FichierDevoir[]
  fichiers_corriges: FichierDevoir[]
}

export interface Diplome {
  id: string
  eleve: User
  classe: Class
  professeur: User
  matiere?: string
  nom_eleve_diplome: string
  note_orale?: string
  note_ecrite?: string
  appreciation?: string
  delivre_at?: string
  created_at: string
  image_diplome: string | null  // ✅ AJOUTE CE CHAMP
}


export interface CatalogueCours {
  id: string
  nom: string
  description?: string
  niveau?: number
  prerequis?: CatalogueCours
  prerequis_nom?: string
  ordre?: number
  progression_eleve?: {
    pourcentage: number
    diplome_obtenu: boolean
    devoirs_valides: number
    total_devoirs: number
    statut: 'acquis' | 'en_cours' | 'non_commence'
  }
  nb_eleves_inscrits?: number
  created_at: string
}

// ─── Cours ────────────────────────────────────────────────────
export interface Cours {
  id: string
  nom: string
  description: string | null
  niveau: number | null
  created_at: string
}
 
export interface PaginatedCours {
  count: number
  results: Cours[]
}
 
export interface GetCoursParams {
  search?: string
  page?: number
}

// ==================== Suivi Presence ====================
export interface SuiviPresence {
  id: string
  created_at: string
  classe: string
  classe_nom: string
  seance: string
  seance_titre: string
  nb_participants: number
  nb_inscrits: number
  resp_query_10_eleve: boolean
  resp_query_fin_eleve: boolean

}

// ==================== FACTURATION ====================

export interface PresenceFacturable {
  id: string
  created_at: string
  classe: string
  classe_nom: string
  seance: string
  seance_titre: string
  nb_participants: number
  nb_inscrits: number
}

// export interface Facture {
//   id: string
//   classe: Class
//   professeur: User
//   periode_mois: string
//   lignes_cours: Array<{ date: string; duree: number }>
//   nb_eleves: number
//   taux_horaire: string
//   montant_total?: string
//   statut: string
//   lien_paypal?: string
//   rib?: string
//   date_echeance?: string
//   envoyee_chat: boolean
//   envoyee_chat_at?: string
//   created_at: string
//   updated_at: string
//   classe_nom: string      // ← ajouter
// }

export interface Paiement {
  id: string
  facture: Facture
  confirme_par?: User
  montant: string
  methode: string
  reference?: string
  paid_at: string
}


// ✅ FactureLigne enrichie avec les champs tarifaires par séance
export interface FactureLigne {
  presence_id: string
  seance_id: string
  date_seance: string
  heure_connexion_prof: string | null
  heure_deconnexion: string | null
  duree_heures: string
  nb_participants: number
  nb_inscrits: number
  // ✅ Nouveaux champs tarifaires
  type_cours_effectif: TypeCours
  tarif_eleve_par_personne: string
  total_collecte_seance: string
  part_direction_seance: string
  part_prof_seance: string
}
 
// ✅ FacturePreview enrichi avec les 3 montants globaux
export interface FacturePreview {
  lignes: FactureLigne[]
  total_heures: string
  nb_inscrits: number
  type_cours: TypeCours
  // ✅ Les 3 montants clés
  total_collecte: string       // ce que paient les élèves
  part_direction: string       // ce que le prof reverse à l'institut
  part_prof: string            // ce que le prof garde
  // rétrocompat
  montant_total: string        // = total_collecte
  taux_horaire: string
  honoraire: string
  nb_participants: number
}
 
// ✅ Facture enrichie avec part_prof / part_direction
export interface Facture {
  id: string
  created_at: string
  classe: string
  classe_nom: string
  professeur: string
  professeur_nom: string
  nb_eleves_inscrits: number
  nbr_eleves_participe: number
  taux_horaire: string
  honoraire: number
  montant_total: string          // total collecté auprès des élèves
  // ✅ Nouveaux champs
  part_direction: number // ce que le prof reverse
  part_prof: number    // ce que le prof garde
  statut: 'brouillon' | 'envoyee' | 'payee' | 'emise'
  lien_paypal: string | null
  rib: string | null
  date_debut: string
  date_fin: string
  date_echeance: string | null
  envoyee_chat: boolean
  envoyee_chat_at: string | null
  periode_debut: string
  periode_fin: string
  // Champs paiements élèves (depuis FactureAvecPaiementsSerializer)
  nb_paiements_a_confirmer: number
  nb_paiements_total: number
  nb_paiements_confirmes: number
}
 
export interface FactureCreatePayload {
  classe_id: string
  date_debut: string   // YYYY-MM-DD
  date_fin: string
  lien_paypal?: string
  rib?: string
}



// ── Participants & Paiements ─────────────────────────────────

export interface FactureParticipant {
  absence_prof_id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_email?: string;
  montant_a_paye: number | null;
  presence_id: string;
  seance_id: string;
}

export interface ParticipantPaymentInput {
  absence_prof_id: string;
  montant_a_paye: number | null; // null = calcul automatique (répartition égale)
}

export interface ParticipantsPaymentPayload {
  facture_id: string;
  payeur_id: string;
  participants: ParticipantPaymentInput[];
}

export interface ParticipantsPaymentData {
  payeur_id: string;
  participants: ParticipantPaymentInput[];
}

export interface ParticipantsPaymentResponse {
  detail: string;
  updated_count: number;
  updated_ids: string[];
}


export interface PresenceDetail {
  id: string
  created_at: string
  heure_connexion: string | null
  heure_deconnexion: string | null
}
 
export interface FactureAdmin {
  id: string
  classe_nom: string
  professeur_nom: string
  nb_eleves_inscrits: number
  taux_horaire: string
  montant_total: string | null
  statut: string
  lien_paypal: string | null
  rib: string | null
  date_echeance: string | null
  envoyee_chat: boolean
  created_at: string
  nbr_eleves_participe: number
  date_debut: string
  date_fin: string
  honoraire: number
  presence_ids: string[]
  seance_ids: string[]
  presences_detail: PresenceDetail[]
}




export interface ClasseLight {
  id: string
  nom: string
  niveau: string | null
  programme: string | null
  type_cours?: TypeCours
}

export interface FactureEleve {
  id: string
  uploade_par: string
  uploade_par_nom: string | null
  classe: string | null
  classe_nom: string | null
  nom_original: string
  url_cloud: string
  mime_type: string | null
  taille_bytes: number | null
  created_at: string
  montant_encaisser: number
  montant_a_payer: string | number
  montant_payer: string | number
  date_debut: string
  date_fin: string
  statut: 'paye' | 'en_attente' | string
}

export interface PaginatedFactures {
  count: number
  next: string | null
  previous: string | null
  results: FactureEleve[]
}
 


// ─────────────────────────────────────────────────────────────
// Types — AbsenceSignaler
// ─────────────────────────────────────────────────────────────

export interface AbsenceSignaler {
  id: string;
  date_absence: string;          // ISO datetime string
  remarque: string | null;
  created_at: string;

  // admin qui a signalé
  admin_display_name: string;

  // professeur concerné (résolu depuis la séance)
  professeur_id: string | null;
  professeur_display_name: string | null;

  // détails séance
  seance_id: string;
  seance_jour: string | null;    // "lundi", "mardi"…
  seance_heure: string | null;   // "HH:MM"
  seance_duree: number | null;   // minutes
  seance_classe_nom: string | null;
  seance_classe_id: string | null;   // ← ajouter après seance_classe_nom

  // helper pour grouper
  mois: string | null;           // "2025-04"
}

export interface AbsenceFilters {
  professeur_id?: string;
  mois?: string;          // "YYYY-MM"
  annee?: string;         // "YYYY"
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedAbsences {
  count: number;
  next: string | null;
  previous: string | null;
  results: AbsenceSignaler[];
}

// Agrégat mensuel utilisé côté table
export interface AbsenceMensuelle {
  professeur_id: string;
  professeur_display_name: string;
  mois: string;           // "2025-04"
  dates: string[];        // liste des date_absence ISO
  count: number;
  remarques: (string | null)[];
}


export interface SeanceManquee {
  seance_id:   string;
  date:        string;       // "YYYY-MM-DD"
  jour_seance: string | null;
  heure:       string | null;
  duree:       number | null;
  classe_nom:  string | null;
  professeur:  string | null;
  seance_classe_id: string | null;  // ← ajouter
}

export interface AdminCalendarResponse {
  seances_manquees:   SeanceManquee[];
  absences_signalees: AbsenceSignaler[];
}

// ==================== PLANNING ====================

export interface PlanningDispo {
  id: string
  professeur: User
  jour_semaine: number // 1-7
  heure_debut: string // "HH:MM:SS"
  heure_fin: string
  couleur: string
  disponible: boolean
  updated_at: string
}

export interface HistoriqueCreneau {
  id: string
  classe: Class
  modifie_par: User
  ancien_jour?: number
  ancienne_heure?: string
  nouveau_jour?: number
  nouvelle_heure?: string
  notif_direction_envoyee: boolean
  created_at: string
}

// ==================== CLASSE VIRTUELLE ====================

export interface Enregistrement {
  id: string
  classe: Class
  seance?: Seance
  demarre_par: User
  url_video?: string
  duree_secondes?: number
  taille_bytes?: number
  statut: string
  started_at: string
  ended_at?: string
  deleted_at?: string
}

export interface TableauBlancAction {
  id: string
  seance: Seance
  auteur: User
  snapshot_json: any // JSON des actions de dessin
  type_action: string
  created_at: string
}

export interface Fichier {
  id: string
  uploade_par: User
  classe?: Class
  nom_original: string
  nom_stockage: string
  fichier_local: string 
  url_cloud: string
  type_fichier: string
  mime_type?: string
  taille_bytes?: number
  created_at: string
  expires_at?: string;      // NOUVEAU : Date de suppression automatique
  is_voice_note?: boolean;  // NOUVEAU : true = ne jamais supprimer
}

// ==================== ADMINISTRATION ====================

export interface AbsenceProf {
  id: string
  professeur: User
  classe: Class
  signale_par: User
  seance?: Seance
  date_absence: string
  type: string
  retard_minutes?: number
  source: string
  remarque?: string
  created_at: string
}

export interface Notification {
  id: string
  destinataire: User
  type: string
  titre: string
  classe?: string
  contenu?: string
  lien?: string
  lu: boolean
  lu_at?: string
  created_at: string
}

export interface TacheDirection {
  id: string
  titre: string
  description?: string
  cible: string
  faite: boolean
  faite_par?: User
  faite_at?: string
  created_by?: User
  created_at: string
}

export interface Contrat {
  id: string
  eleve: User
  classe: Class
  version_reglement: string
  contenu_snapshot: string
  signe_at: string
  ip_signature?: string
}

// ==================== DASHBOARDS ====================

export interface DashboardDirection {
  total_eleves: number
  profs_actifs: number
  classes_actives: number
  classes_a_suppr: number
  alertes_importantes: number
  revenus_estimes: number
}

export interface DashboardAdmin {
  nombre_professeurs: number
  classes_en_pause: number
  classes_a_signaler: number
}

export interface DashboardProf {
  compteur_admin: number
  mes_classes_actives: number
  devoirs_en_attente: number
}

export interface DashboardEleve {
  classes_actives: number
  prochain_cours?: Seance
  notifications: number
}



export interface DashboardFilters {
  professor_id?: string;
  class_id?: string;
  start_date?: string;
  end_date?: string;
  programme?: string;
}



export interface ProfesseurDue {
  id: string
  nom_complet: string
  part_prof: number
  part_dir: number
  nb_factures: number
}

export interface EleveOption {
  id: string
  display_name: string | null
  email: string
}

export interface DirectionDashboardData {
  // Finances profs
  montant_due_prof_total: number
  montant_due_directrice: number
  montant_total_factures: number
  nb_factures_envoyees: number
  nb_factures_payees: number
  professeurs_concernes: ProfesseurDue[]

  // Classes
  nb_classes_global: number
  nb_classes_filtre: number

  // Élèves
  nb_eleves_global: number
  nb_eleves_filtre: number

  // Factures élèves
  montant_eleve_a_payer: number
  montant_eleve_paye: number

  // Séances
  nb_seances_actives: number

  // Graph
  evolution_heures: EvolutionPoint[]

  // Options filtre élève
  eleves_options: EleveOption[]
}

export interface EvolutionPoint {
  date: string
  professeur_id: string
  professeur: string
  heures: number
}

export interface ProfesseurOption {
  id: string
  display_name: string
}

export interface ClasseOption {
  id: string
  nom: string
  programme: string | null
}




// 🔷 Types de base
export interface UserForPlanning {
  id: string;
  display_name: string | null;
  email: string;
}

// 🟢 Class : uniquement pour l'affichage (pas de logique planning)
export interface ClassForPlanning {
  id: string;
  nom: string;
  niveau: string | null;
  programme: string | null;
  professeur: UserForPlanning | null;
  couleur: 'bleu' | 'orange' | 'rouge' | 'vert' | 'violet' | null;
  statut?: string | null;
  // ❌ On retire : jour_semaine, heure_debut, duree_minutes (inutiles ici)
}

export interface PresenceForPlanning {
  id: string;
  heure_connexion_prof: string | null; // ISO datetime
  temps_prof: number | null; // minutes
  retard_minutes: number | null;
  resp_query_10_eleve: boolean | null;
  resp_query_fin_eleve: boolean | null;
  enregistrement_system: boolean | null;
}
// 🟢 PlanningItem : basé UNIQUEMENT sur Seances + Presence
export interface PlanningItem {
  id: string;
  classe: ClassForPlanning;
  
  // ✅ Champs réels de Seances (ceux qu'on utilise)
  date_seance: string;           // "2024-01-15" → pour le filtrage/calendrier
  heure_debut_reelle: string;    // "09:00:00" → pour l'affichage horaire
  duree_reelle_minutes: number;  // 90 → pour la durée visuelle
  
  // Metadata
  jour_seance: string | null;    // "Lundi" → label optionnel
  statut: 'prevu' | 'en_cours' | 'terminee' | 'annulee' | 'supprimer' | 'horaire_valide' | 'horaire_non_valide' | 'active' | null;
  
  // Données réelles (Presence liée)
  presence: PresenceForPlanning | null;
  
  // Champs calculés (backend)
  statut_realisation: 'planned' | 'in_progress' | 'completed' | 'absent' | 'late' | 'deleted';
  ecart_minutes: number | null;
  is_today: boolean;
  
  created_at: string;
}


export interface UpdateSeancePayload {
   id: string;
   duree_reelle_minutes?: number;
   heure_debut_reelle?: string;
   statut?: string;
 }

export interface CreateSeancePayload {
   classe?:                string;   // optionnel
   professeur_disponible?: string;   // requis si pas de classe
   jour_seance:            string;
   heure_debut_reelle:     string;
   duree_reelle_minutes:   number;
   statut:                 'active';
 }


// 🔷 Filtres de recherche
export interface PlanningFilters {
  start_date?: string;
  end_date?: string;
  classe?: string;
  professeur?: string;
  statut_realisation?: 'active' | 'en_pause' | 'a_supprimer' | 'disponibilite' ;
  view?: 'day' | 'week' | 'month' | 'list';
  search?: string;
  professeur_id?: string   // ← ajouter ça
}

// 🔷 Réponse API paginée
export interface PlanningResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlanningItem[];
}
/**
 * Présence du professeur pour une séance donnée.
 * Retournée par GET /api/presences/prof/?seance_id=<uuid>
 */
export interface PresenceProf {
  id: string
  /** Heure de connexion de l'élève (indicatif) */
  heure_connexion: string | null       // ISO datetime
  /** Heure de déconnexion de l'élève (indicatif) */
  heure_deconnexion: string | null     // ISO datetime
  /** Heure de connexion saisie manuellement par le prof */
  heure_connexion_prof: string | null  // "HH:MM:SS" ou "HH:MM"
  /** Durée effective en minutes saisie par le prof */
  temps_prof: number | null
  created_at: string
  date_seance: string | null           // "YYYY-MM-DD"
}
 
/**
 * Ligne élève dans le modal "Élèves" d'une séance.
 * Retournée par GET /api/absences-eleves/?seance_id=<uuid>
 */
export interface AbsenceEleveRow {
  id: string
  eleve_id: string
  eleve_display_name: string | null
  /** true = a suivi tout le cours, false = partiellement, null = non renseigné */
  temps_effectif: boolean | null
  /** null = cours suivi au complet ; sinon durée en minutes */
  durree_eleve: number | null
  /** Heure de connexion de l'élève (lecture seule, indicatif) */
  heure_connexion_eleve: string | null  // "HH:MM"
  /** Heure de déconnexion de l'élève (lecture seule, indicatif) */
  heure_deconnexion_eleve: string | null // "HH:MM"
  created_at: string
}

// ==================== UTILITAIRES ====================

/**
 * Type utilitaire pour les réponses paginées DRF
 * Ex: { count: 25, next: "...", previous: null, results: [...] }
 */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Type pour les réponses d'erreur API standardisées
 */
export interface ApiError {
  error?: string
  detail?: string
  [key: string]: any
}
