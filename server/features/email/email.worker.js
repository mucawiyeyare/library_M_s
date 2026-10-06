import { deliverEmails } from './email.service.js'
import { queueReminders } from './reminders.service.js'
export function startEmailWorker() {
  let running = false,
    stopped = false,
    lastReminder = 0
  async function tick() {
    if (running || stopped) return
    running = true
    try {
      if (Date.now() - lastReminder > 3600000) {
        await queueReminders()
        lastReminder = Date.now()
      }
      await deliverEmails()
    } catch {
      console.error('Email worker could not process messages. Check database/email configuration.')
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => {
    void tick()
  }, 30000)
  timer.unref()
  void tick()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
