import { useCallback, useRef } from 'react'
import { useStore } from '../stores/useStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { Channel } from '../types'

export function usePlayChannel() {
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)
  const addHistoryEntry = useStore((s) => s.addHistoryEntry)

  const playTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const playIdRef = useRef(0)
  const retryCountRef = useRef(0)

  const play = useCallback(
    (channel: Channel, retryCount = 0) => {
      const id = ++playIdRef.current
      retryCountRef.current = retryCount
      setCurrentChannel(channel)

      clearTimeout(playTimerRef.current)
      const state = useStore.getState()
      if (state.settingsOpen) state.setSettingsOpen(false)

      window.electronAPI.switchChannel(channel.url).then((result) => {
        if (id !== playIdRef.current) return
        if (result.success) {
          addHistoryEntry(channel)
          retryCountRef.current = 0
        } else {
          const settings = useSettingsStore.getState().settings
          const currentRetry = retryCountRef.current
          if (settings.autoReconnect && currentRetry < 3) {
            const delay = settings.reconnectInterval * (currentRetry + 1)
            console.error(`[play] ${channel.name} 失败，${delay / 1000}s 后重试 (${currentRetry + 1}/3)`)
            playTimerRef.current = setTimeout(() => {
              play(channel, currentRetry + 1)
            }, delay)
          } else {
            console.error('[play]', channel.name, result.error)
          }
        }
      })
    },
    [setCurrentChannel, addHistoryEntry],
  )

  return play
}
