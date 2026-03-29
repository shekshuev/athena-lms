import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'

export const useSocketStore = defineStore('socket', () => {
  const config = useRuntimeConfig()
  const toast = useToast()

  const { t } = useI18n()

  const socket = ref<Socket | null>(null)
  const isConnected = ref(false)
  const socketId = ref<string | null>(null)

  const forcedClosedExams = ref<Record<string, unknown>>({})

  function connect() {
    if (socket.value?.connected) return

    const url = config.public.wsUrl as string

    const socketInstance = io(url, {
      transports: ['websocket'],
      autoConnect: true
    })

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id)
      isConnected.value = true
      socketId.value = socketInstance.id || null
    })

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected')
      isConnected.value = false
      socketId.value = null
    })

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
    })

    socket.value = markRaw(socketInstance)
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
      socketId.value = null
    }
  }

  function on(event: string, callback: (...args: unknown[]) => void) {
    if (!socket.value) {
      console.warn('Socket not initialized, cannot subscribe to', event)
      return
    }
    socket.value.on(event, callback)
  }

  function off(event: string, callback?: (...args: unknown[]) => void) {
    if (!socket.value) return
    socket.value.off(event, callback)
  }

  function emit(event: string, ...args: unknown[]) {
    if (!socket.value) return
    socket.value.emit(event, ...args)
  }

  return {
    socket,
    isConnected,
    socketId,
    connect,
    disconnect,
    on,
    off,
    emit
  }
})
