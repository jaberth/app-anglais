// Hook d'acces a la progression pour les composants.
// Charge l'etat au montage, se resynchronise a chaque ecriture via subscribe().

import { useCallback, useEffect, useState } from 'react'
import { loadProgress, subscribe, updateProgress } from './progressStore.js'

export function useProgress() {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    loadProgress().then((state) => {
      // Le composant peut avoir ete demonte pendant la lecture.
      if (!active) return
      setProgress(state)
      setLoading(false)
    })

    const unsubscribe = subscribe((state) => {
      if (active) setProgress(state)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const update = useCallback((updater) => updateProgress(updater), [])

  return { progress, loading, update }
}
