// Primitives d'UI partagees par les ecrans, pour garder une seule definition du
// style des cartes et des boutons.

export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function CardTitle({ children }) {
  return <h2 className="text-base font-semibold text-ink-900">{children}</h2>
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'text-ink-500 hover:text-ink-900',
  }

  return (
    <button
      type="button"
      // min-h-11 : cible tactile confortable, l'app est utilisee au pouce.
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

/**
 * Bandeau des ecrans encore a implementer : rend le scaffold navigable et
 * documente ce qui reste a faire, plutot qu'un ecran vide.
 */
export function ComingSoon({ title, children }) {
  return (
    <Card className="border-dashed">
      <CardTitle>{title}</CardTitle>
      <div className="mt-2 space-y-2 text-sm text-ink-500">{children}</div>
    </Card>
  )
}
