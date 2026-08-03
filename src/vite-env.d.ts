/// <reference types="vite/client" />

// Déclare les variables d'environnement personnalisées que tu utilises
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // Tu pourras ajouter d'autres variables ici plus tard si besoin, ex:
  // readonly VITE_LIVEKIT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
