import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { config } from '../../config/env.js'
let saving = Promise.resolve()
export async function persistMailConfiguration(
  input,
  envPath = fileURLToPath(new URL('../../.env', import.meta.url)),
) {
  const job = saving.then(async () => {
    const password = input.password || (input.user === config.SMTP_USER ? config.SMTP_PASSWORD : '')
    let source = await readFile(envPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return ''
      throw error
    })
    const values = {
      MAIL_TRANSPORT: input.transport,
      SMTP_USER: input.user,
      SMTP_PASSWORD: password,
    }
    for (const [key, value] of Object.entries(values)) {
      const line = `${key}=${JSON.stringify(value)}`
      let found = false
      source = source
        .split(/\r?\n/)
        .flatMap((existing) => {
          if (
            existing
              .split('=')[0]
              .trim()
              .replace(/^export\s+/, '') !== key
          )
            return [existing]
          if (found) return []
          found = true
          return [line]
        })
        .join('\n')
      if (!found) source = source.trimEnd() + '\n' + line + '\n'
    }
    const temporary = `${envPath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, source, { mode: 0o600, flag: 'wx' })
      await rename(temporary, envPath)
    } finally {
      await unlink(temporary).catch(() => {})
    }
    config.MAIL_TRANSPORT = input.transport
    config.SMTP_USER = input.user
    config.SMTP_PASSWORD = password
  })
  saving = job.catch(() => {})
  await job
}
