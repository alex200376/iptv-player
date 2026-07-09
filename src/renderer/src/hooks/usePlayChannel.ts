import { useCallback, useRef } from 'react'
import { useStore } from '../stores/useStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { Channel } from '../types'

export function usePlayChannel() {
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)
  const addHistoryEntry = useStore((s) => s.addHistoryEntry)

  // Single source of truth for the "current" play session
  const playIdRef = useRef(0)
  // Pending retry timer — cleared whenever a new channel is chosen
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>()
  // Debounce timer — prevents IPC storm when user clicks rapidly
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const play = useCallback(
    (channel: Channel, retryCount = 0) => {
      // Always cancel any pending retry from a previous (possibly unavailable) channel
      clearTimeout(retryTimerRef.current)

      // Debounce rapid clicks: wait 120ms before actually firing IPC
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        const id = ++playIdRef.current

        setCurrentChannel(channel)
        const state = useStore.getState()
        if (state.settingsOpen) state.setSettingsOpen(false)

        window.electronAPI.switchChannel(channel.url).then((result) => {
          // Stale response — user already moved to another channel
          if (id !== playIdRef.current) return

          if (result.success) {
            addHistoryEntry(channel)
          } else {
            const settings = useSettingsStore.getState().settings
            if (settings.autoReconnect && retryCount < 3) {
              const delay = settings.reconnectInterval * (retryCount + 1)
              console.warn(
                `[play] ${channel.name} failed, retrying in ${delay}ms (${retryCount + 1}/3)`,
              )
              retryTimerRef.current = setTimeout(() => {
                // Only retry if this channel is still the active one
                if (id === playIdRef.current) {
                  play(channel, retryCount + 1)
                }
              }, delay)
            } else {
              console.error('[play]', channel.name, result.error)
            }
          }
        })
      }, retryCount === 0 ? 120 : 0) // debounce only on first play, not on retries
    },
    [setCurrentChannel, addHistoryEntry],
  )

  return play
}
