import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config/env.js'
const directory = fileURLToPath(new URL('../../backups', import.meta.url))
await mkdir(directory, { recursive: true })
const file = resolve(
  directory,
  `biblioteca-${new Date().toISOString().replaceAll(':', '-')}.archive.gz`,
)
// Invoke directly without a shell; never print the connection string or its credentials.
const processHandle = spawn(
  'mongodump',
  [`--uri=${config.MONGODB_URI}`, `--archive=${file}`, '--gzip'],
  { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
)
processHandle.stderr.on('data', () => {
  /* mongodump output may contain connection details; report a safe result below. */
})
processHandle.on('error', () => {
  console.error(
    'Backup could not start. Install MongoDB Database Tools and ensure mongodump is on PATH.',
  )
  process.exitCode = 1
})
processHandle.on('close', (code) => {
  if (code === 0) console.log(`Backup saved: ${file}`)
  else {
    console.error('Backup failed. Check database access and Database Tools compatibility.')
    process.exitCode = 1
  }
})
