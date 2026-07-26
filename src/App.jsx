import { useState } from 'react'
import AppShell from './components/AppShell.jsx'
import DashboardPage from './features/dashboard/DashboardPage.jsx'
import PlacementTestPage from './features/placement-test/PlacementTestPage.jsx'
import DialoguePage from './features/dialogue/DialoguePage.jsx'
import GrammarPage from './features/grammar/GrammarPage.jsx'
import VocabularyPage from './features/vocabulary/VocabularyPage.jsx'
import { useProgress } from './lib/storage/useProgress.js'

// Navigation par etat local plutot que par router : l'app compte 5 ecrans, tous
// atteints depuis le tableau de bord. Pas d'URL a partager (mono-utilisatrice,
// usage PWA plein ecran), donc pas de dependance de routage a maintenir.
const VIEWS = {
  dashboard: DashboardPage,
  placement: PlacementTestPage,
  dialogue: DialoguePage,
  grammar: GrammarPage,
  vocabulary: VocabularyPage,
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const { progress, loading, update } = useProgress()

  const Screen = VIEWS[view] ?? DashboardPage

  return (
    <AppShell view={view} onNavigate={setView}>
      {loading ? (
        <p className="py-12 text-center text-ink-500">Chargement de ta progression…</p>
      ) : (
        <Screen progress={progress} updateProgress={update} onNavigate={setView} />
      )}
    </AppShell>
  )
}
