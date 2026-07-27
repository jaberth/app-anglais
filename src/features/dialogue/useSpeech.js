// Reconnaissance et synthese vocales pour le mode conversation.
//
// DEUX CHEMINS pour la reconnaissance, choisis a l'execution :
//
//  1. Web Speech API (webkitSpeechRecognition) : gratuite, instantanee, aucune
//     consommation de quota. C'est le chemin nominal.
//  2. Enregistrement MediaRecorder envoye a Gemini : plus lent et facture, mais
//     il fonctionne partout. C'est le repli.
//
// Le repli n'est pas theorique : sur iOS, la reconnaissance native est absente
// ou defaillante selon les versions, et particulierement en PWA installee — soit
// exactement le contexte d'usage vise. On ne peut pas non plus se contenter de
// tester la presence de l'objet : il existe parfois tout en echouant au premier
// demarrage. D'ou la bascule sur ERREURS_FATALES, qui condamne le chemin natif
// pour le reste de la session des qu'il se revele inutilisable.

import { useCallback, useEffect, useRef, useState } from 'react'

// Erreurs qui signalent une API inutilisable, par opposition a un simple
// silence ou a un tour rate : inutile de reessayer le natif ensuite.
const ERREURS_FATALES = new Set(['service-not-allowed', 'audio-capture', 'not-allowed'])

const LANGUE = 'en-US'

function getRecognitionClass() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function supportsNativeRecognition() {
  return getRecognitionClass() !== null
}

/**
 * Reconnaissance vocale : `start()` ouvre le micro, `stop()` le referme et
 * resout le texte final. `transcript` suit la dictee en direct.
 *
 * `onFallbackNeeded` est appele si le chemin natif se revele inutilisable ;
 * c'est au composant de basculer sur l'enregistrement.
 */
export function useRecognition({ onResult, onFallbackNeeded }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  const finalRef = useRef('')
  // Sans cette garde, l'evenement `onend` qui suit un stop() volontaire
  // declencherait un second envoi du meme tour.
  const stoppingRef = useRef(false)

  const stop = useCallback(() => {
    stoppingRef.current = true
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const RecognitionClass = getRecognitionClass()
    if (!RecognitionClass) {
      onFallbackNeeded?.()
      return
    }

    const recognition = new RecognitionClass()
    recognition.lang = LANGUE
    // continuous : elle doit pouvoir marquer une pause en cherchant ses mots
    // sans que le micro se referme — c'est precisement ce qui arrive a une
    // apprenante hesitante, et le couper la serait le pire moment.
    recognition.continuous = true
    recognition.interimResults = true

    finalRef.current = ''
    stoppingRef.current = false
    setTranscript('')

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalRef.current += result[0].transcript
        else interim += result[0].transcript
      }
      setTranscript((finalRef.current + interim).trim())
    }

    recognition.onerror = (event) => {
      if (ERREURS_FATALES.has(event.error)) {
        setListening(false)
        onFallbackNeeded?.()
        return
      }
      // 'no-speech' et 'aborted' sont des non-evenements : elle n'a rien dit,
      // ou a coupe elle-meme. On laisse onend faire le menage.
    }

    recognition.onend = () => {
      setListening(false)
      const texte = finalRef.current.trim()
      if (texte) onResult?.(texte)
      else if (!stoppingRef.current) onFallbackNeeded?.()
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
    } catch {
      // Certains navigateurs levent si start() est appele deux fois de suite.
      setListening(false)
      onFallbackNeeded?.()
    }
  }, [onFallbackNeeded, onResult])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { listening, transcript, start, stop }
}

/**
 * Synthese vocale de la replique du coach.
 *
 * Volontairement "best effort" : si aucune voix anglaise n'est disponible, on
 * n'annonce pas d'erreur. La replique reste lisible a l'ecran, la conversation
 * n'est jamais bloquee par la voix.
 */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef(null)

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return

    const choisirVoix = () => {
      const voix = speechSynthesis.getVoices().filter((item) => item.lang?.startsWith('en'))
      // Une voix britannique ou americaine de qualite plutot que la premiere
      // venue, qui est souvent une voix compacte tres synthetique.
      voiceRef.current =
        voix.find((item) => /Google (UK|US)/i.test(item.name)) ??
        voix.find((item) => item.localService === false) ??
        voix[0] ??
        null
    }

    choisirVoix()
    // La liste arrive de facon asynchrone sur Chrome.
    speechSynthesis.addEventListener('voiceschanged', choisirVoix)
    return () => speechSynthesis.removeEventListener('voiceschanged', choisirVoix)
  }, [])

  const speak = useCallback((text) => {
    if (typeof speechSynthesis === 'undefined' || !text) return

    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANGUE
    if (voiceRef.current) utterance.voice = voiceRef.current
    // Legerement ralenti : on simule une reunion, pas un flash info. A vitesse
    // normale, une B1 perd le fil et se remet a lire l'ecran au lieu d'ecouter.
    utterance.rate = 0.95
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    speechSynthesis.speak(utterance)
  }, [])

  const shutUp = useCallback(() => {
    if (typeof speechSynthesis === 'undefined') return
    speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => () => shutUp(), [shutUp])

  return { speaking, speak, shutUp }
}

/**
 * Repli : enregistre le micro et rend un blob audio, transcrit ensuite par
 * Gemini cote Worker.
 */
export function useRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        // Toujours liberer le micro : sans cela l'indicateur d'enregistrement
        // du systeme reste allume apres la session.
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        if (blob.size > 0) onRecorded?.(blob)
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch (caught) {
      setError(
        caught.name === 'NotAllowedError'
          ? 'Micro refusé. Autorise l’accès au micro pour parler.'
          : 'Micro indisponible sur cet appareil.',
      )
      setRecording(false)
    }
  }, [onRecorded])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    setRecording(false)
  }, [])

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    },
    [],
  )

  return { recording, error, start, stop }
}
