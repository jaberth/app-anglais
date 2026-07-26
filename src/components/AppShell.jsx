// Coquille de l'app : en-tete, zone de contenu, barre de navigation basse.
// Mobile-first : la navigation est au pouce sur mobile, et remonte en barre
// horizontale classique a partir de sm.

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Accueil', icon: HomeIcon },
  { id: 'dialogue', label: 'Dialogue', icon: ChatIcon },
  { id: 'grammar', label: 'Grammaire', icon: BookIcon },
  { id: 'vocabulary', label: 'Vocabulaire', icon: TagIcon },
]

export default function AppShell({ view, onNavigate, children }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-brand-700 text-white">
        <div className="mx-auto w-full max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <p className="text-xs uppercase tracking-widest text-brand-200">Coach Anglais Pro</p>
          <h1 className="text-lg font-semibold">{titleFor(view)}</h1>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-5">{children}</main>

      <nav className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex w-full max-w-2xl pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                    active ? 'text-brand-700' : 'text-ink-400 hover:text-ink-700'
                  }`}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function titleFor(view) {
  switch (view) {
    case 'placement':
      return 'Test de niveau'
    case 'dialogue':
      return 'Dialogue'
    case 'grammar':
      return 'Grammaire'
    case 'vocabulary':
      return 'Vocabulaire'
    default:
      return 'Ta session du jour'
  }
}

// Icones inline : evite une dependance d'icones pour quatre pictogrammes.
function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChatIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" strokeLinejoin="round" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" strokeLinejoin="round" />
    </svg>
  )
}

function TagIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 12.5V4h8.5L21 13.5 13.5 21 4 11.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
