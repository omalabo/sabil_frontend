import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import { selectAuth } from './store/authSlice'

// Layouts
import AppLayout from './components/layout/AppLayout'
import RoleGuard from './components/layout/RoleGuard'

// Pages publiques
import LoginPage from './pages/auth/LoginPage'
import ForcePasswordChange from './pages/auth/ForcePasswordChange'

// Pages Élève
import EleveDashboard from './pages/eleve/Dashboard'
import EleveClasses from './pages/eleve/Classes'
import ClasseDetail from './pages/eleve/ClasseDetail'
import EleveChatAdmin from './pages/eleve/ChatAdmin'
import MesDiplomes from './pages/eleve/MesDiplomes'
import EleveEnregistrements from './pages/eleve/Enregistrements'
import EleveParametres from './pages/eleve/Parametres'
import EleveFactures from './pages/eleve/Factures'

// Pages Professeur
import ProfDashboard from './pages/professeur/Dashboard'
import ProfClasses from './pages/professeur/Classes'
import ProfPlanning from './pages/professeur/Planning'
import ProfMessageAdmin from './pages/professeur/MessageAdmin'
import ProfMessageDirection from './pages/professeur/MessageDirection'
import ProfParametres from './pages/professeur/Parametres'
import ProfFactures from './pages/professeur/Factures'
import Devoirs from './pages/professeur/Devoir'
import DevoirEleves  from './pages/professeur/DevoirEleves'
import GenerateurDiplome  from './pages/professeur/GenerateurDiplome'



// Pages Admin
import AdminDashboard from './pages/admin/Dashboard'
import AdminProfesseurs from './pages/admin/Professeurs'
import AdminClassesParProf from './pages/admin/ClassesParProf'
import AdminSignalements from './pages/admin/Signalements' // ✅ NOUVEAU
import AdminPlanningGlobal from './pages/admin/PlanningGlobal' // ✅ NOUVEAU
import AdminParametres from './pages/admin/Parametres'
import AdminMessagesPrives from './pages/admin/MessagesPrives'
import AdminSuiviPresences from './pages/admin/SuiviPresence'
import AdminFactures from './pages/admin/AdminFactures'
import TachesAdminPage from './pages/admin/Taches'
import AdminElevesAPayerPage from './pages/admin/AdminElevesAPayerPage'

// // Pages Direction
import DirectionDashboard from './pages/direction/Dashboard'
import DirectionGestionComptes from './pages/direction/GestionComptes'
import DirectionPlanningGlobal from './pages/direction/PlanningGlobal'
import DirectionAdmins from './pages/direction/Admins' // ✅ NOUVEAU
import DirectionRapports from './pages/direction/Rapports' // ✅ NOUVEAU
import DirectionProfesseurs from './pages/direction/Professeurs'
import DirectionParametres from './pages/direction/Parametres'
import DirectionFacturesSupervision from './pages/direction/FacturesSupervision'

import DirectionProfesseurClasses from './pages/direction/ProfesseurClasses'
import AdminClasseSurveillance from './pages/admin/ClasseSurveillance'
import DirectionGestionInscriptions from './pages/direction/GestionInscriptions'
import DirectionClasseDetail from './pages/direction/ClasseDetail'
import CatalogueCours from './pages/direction/CatalogueCours'
import TachesDirectionPage from './pages/direction/Taches'
import AnnoncesPage from './pages/direction/Annonces'
import DirectionChat from './pages/direction/DirectionChat'

import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

/**
 * Composant racine de l'application
 * Gère le routing conditionnel selon :
 * - Authentification (connecté ou non)
 * - Rôle utilisateur (eleve/professeur/admin/direction)
 * - Obligation de changement de mot de passe
 */
/**
 * 🔒 Bloque la navigation directe (par URL) d'un élève désactivé vers
 * toute route élève autre que /eleve/factures. RoleGuard ne vérifie que
 * le rôle, pas is_active — ce garde comble ce trou.
 */
function EleveActiveGuard() {
  const { user } = useAppSelector(selectAuth)
  const location = useLocation()

  const isInactiveEleve = user?.role === 'eleve' && user?.is_active === false

  if (isInactiveEleve && location.pathname !== '/eleve/factures') {
    return <Navigate to="/eleve/factures" replace />
  }

  return <Outlet />
}

function App() {
  const { user, token, mustChangePassword } = useAppSelector(selectAuth)

  return (
    <Routes>
      {/* 🔐 Routes publiques - accessibles sans authentification */}
      <Route path="/login" element={
        // Si déjà connecté, rediriger vers le dashboard approprié
        token ? <Navigate to={getDashboardPath(user)} replace /> : <LoginPage />
      } />
      
      <Route path="/auth/force-change-password" element={
        // Accès uniquement si mustChangePassword = true
        // ✅ Si pas de token du tout → login
        // ✅ Si pas de token du tout → login
        !token ? <Navigate to="/login" replace /> :
        !mustChangePassword ? <Navigate to={getDashboardPath(user)} replace /> : <ForcePasswordChange />
      } />

       {/* 🔑 Mot de passe oublié — routes publiques */}
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />

      {/* 🛡️ Routes protégées - nécessitent authentification + rôle */}
      <Route element={<AppLayout />}>
        
        {/* 👤 Espace Élève */}
        <Route element={<RoleGuard allowedRoles={['eleve']} />}>
          <Route element={<EleveActiveGuard />}>
            <Route path="/eleve/dashboard" element={<EleveDashboard />} />
            {/* <Route path="/eleve/classes" element={<EleveClasses />} /> */}
            <Route path="/eleve/classes" element={<ClasseDetail role="eleve" />} />
            <Route path="/eleve/classe/:id" element={<ClasseDetail role="eleve" />} />
            <Route path="/eleve/chat-admin" element={<EleveChatAdmin />} />
            <Route path="/eleve/diplomes" element={<MesDiplomes />} />
            <Route path="/eleve/enregistrements" element={<EleveEnregistrements />} />
            <Route path="/eleve/parametres" element={<EleveParametres />} />
            <Route path="/eleve/factures" element={<EleveFactures />} />
          </Route>
        </Route>

        {/* 👨‍🏫 Espace Professeur */}
        <Route element={<RoleGuard allowedRoles={['professeur']} />}>
          <Route path="/professeur/dashboard" element={<ProfDashboard />} />
          <Route path="/professeur/classes" element={<ProfClasses />} />
          <Route path="/professeur/classe/:id" element={<ClasseDetail role="professeur" />} />
          <Route path="/professeur/planning" element={<ProfPlanning />} />
          <Route path="/professeur/message-admin" element={<ProfMessageAdmin />} /> {/* ✅ */}
          <Route path="/professeur/message-direction" element={<ProfMessageDirection />} /> {/* ✅ */}
          <Route path="/professeur/parametres" element={<ProfParametres />} /> {/* ✅ */}
          <Route path="/professeur/factures" element={<ProfFactures />} />
          <Route path="/professeur/classe/:classeId/devoirs" element={<Devoirs />} />
          <Route path="/professeur/devoirs/:devoirId/eleves"  element={<DevoirEleves />} />
          <Route path="/professeur/cours" element={<ClasseDetail role="professeur" />} />
          <Route path="/professeur/diplome" element={<GenerateurDiplome role="professeur" />} />
        </Route>

        {/* ⚙️ Espace Admin */}
        <Route element={<RoleGuard allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/professeurs" element={<AdminProfesseurs />} />
          <Route path="/admin/professeur/:id/classes" element={<AdminClassesParProf />} />
          <Route path="/admin/signalements" element={<AdminSignalements />} /> {/* ✅ */}
          <Route path="/admin/planning-global" element={<AdminPlanningGlobal />} /> {/* ✅ */}
          <Route path="/admin/parametres" element={<AdminParametres />} />
          <Route path="/admin/classe/:id/surveillance" element={<AdminClasseSurveillance />} />
          <Route path="/admin/messages-prives" element={<AdminMessagesPrives />} />
          <Route path="/admin/suivi-presences" element={<AdminSuiviPresences />} />
          <Route path="/admin/factures" element={<AdminFactures />} />
          <Route path="/admin/classe/:id" element={<ClasseDetail role="admin" />} />
          <Route path="/admin/classes" element={<ClasseDetail role="admin" />} />
          <Route path="/admin/taches" element={<TachesAdminPage/>} />
          <Route path="/admin/eleve-factures" element={<AdminElevesAPayerPage/>} />
        </Route>

        {/* 👑 Espace Direction */}
        <Route element={<RoleGuard allowedRoles={['direction']} />}>
          <Route path="/direction/dashboard" element={<DirectionDashboard />} />
          <Route path="/direction/comptes" element={<DirectionGestionComptes />} />
          <Route path="/direction/planning-global" element={<DirectionPlanningGlobal />} />
          <Route path="/direction/admins" element={<DirectionAdmins />} /> {/* ✅ */}
          <Route path="/direction/rapports" element={<DirectionRapports />} /> {/* ✅ */}
          <Route path="/direction/professeurs" element={<DirectionProfesseurs />} /> {/* ✅ */}
          <Route path="/direction/parametres" element={<DirectionParametres />} />
          <Route path="/direction/professeur/:id/classes" element={<DirectionProfesseurClasses />} />
          <Route path="/direction/classe/:id" element={<DirectionClasseDetail />} />
          <Route path="/direction/gestion-inscriptions/:classeId" element={<DirectionGestionInscriptions />} />
          <Route path="/direction/factures" element={<DirectionFacturesSupervision />} />
          <Route path="/direction/catalogue-cours" element={<CatalogueCours />} />
          <Route path="/direction/classes" element={<ClasseDetail role="direction" />} />
          <Route path="/direction/taches" element={<TachesDirectionPage/>} />
          <Route path="/direction/annonces" element={<AnnoncesPage/>} />
          <Route path="/admin/messages-admins" element={<DirectionChat/>} />
        </Route>

      </Route>

      {/* 🔄 Route par défaut : redirection vers login ou dashboard */}
      <Route path="/" element={
        <Navigate to={token ? getDashboardPath(user) : '/login'} replace />
      } />
      
      {/* ❌ Page 404 */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-neutral-900 mb-2">404</h1>
            <p className="text-neutral-600">Page non trouvée</p>
          </div>
        </div>
      } />
    </Routes>
  )
}

/**
 * Helper : détermine le chemin du dashboard selon le rôle
 * @param user - Utilisateur connecté (role + is_active)
 * @returns Chemin de redirection approprié
 */
function getDashboardPath(user?: { role?: string; is_active?: boolean }): string {
  if (!user?.role) return '/login'

  // 🔒 Élève désactivé : toujours renvoyé vers Factures, jamais le dashboard
  if (user.role === 'eleve' && user.is_active === false) {
    return '/eleve/factures'
  }

  switch (user.role) {
    case 'eleve': return '/eleve/dashboard'
    case 'professeur': return '/professeur/dashboard'
    case 'admin': return '/admin/dashboard'
    case 'direction': return '/direction/dashboard'
    default: return '/login'
  }
}

export default App