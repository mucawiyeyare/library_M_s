import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import mongoose from 'mongoose'
const MongoClient = mongoose.mongo.MongoClient
// A persistent library-only instance. Never modify the installed MongoDB service.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
const executable = process.env.MONGOD_PATH || 'mongod'
const directory = fileURLToPath(new URL('../../.local-mongodb', import.meta.url))
const dataPath = join(directory, 'data')
const configPath = join(directory, 'mongod.cfg')
const directUri = 'mongodb://127.0.0.1:27018/admin?directConnection=true'
async function connect() {
  const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 1500 })
  try {
    await client.connect()
    return client
  } catch {
    await client.close()
    return null
  }
}
async function verifyOwnership(client) {
  const options = await client.db('admin').command({ getCmdLineOpts: 1 })
  const actualPath = String(options.parsed?.storage?.dbPath ?? '')
  if (resolve(actualPath).toLowerCase() !== dataPath.toLowerCase())
    throw new Error('Port 27018 belongs to another MongoDB instance. No changes were made to it.')
}
let client = await connect()
try {
  if (!client) {
    if (process.env.MONGOD_PATH) await access(executable)
    await mkdir(dataPath, { recursive: true })
    await writeFile(
      configPath,
      `storage:\n  dbPath: ${JSON.stringify(dataPath)}\nsystemLog:\n  destination: file\n  path: ${JSON.stringify(join(directory, 'mongod.log'))}\n  logAppend: true\nnet:\n  port: 27018\n  bindIp: 127.0.0.1\nreplication:\n  replSetName: biblioteca-rs\n`,
    )
    const child = spawn(executable, ['--config', configPath], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
    let startupError = null
    child.on('error', (error) => {
      startupError = error
    })
    child.unref()
    for (let attempt = 0; attempt < 20; attempt++) {
      if (startupError) throw startupError
      client = await connect()
      if (client) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!client)
      throw new Error('The library MongoDB did not start. Check .local-mongodb/mongod.log.')
  }
  await verifyOwnership(client)
  const admin = client.db('admin')
  const hello = await admin.command({ hello: 1 })
  if (!hello.setName)
    await admin.command({
      replSetInitiate: { _id: 'biblioteca-rs', members: [{ _id: 0, host: '127.0.0.1:27018' }] },
    })
  else if (hello.setName !== 'biblioteca-rs')
    throw new Error('Unexpected replica-set name. No replica-set changes were made.')
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await admin.command({ hello: 1 })
    if (state.isWritablePrimary) {
      console.log('Library MongoDB is ready on 127.0.0.1:27018 (biblioteca-rs).')
      console.log(`Persistent data: ${dataPath}`)
      console.log('The existing MongoDB service on port 27017 was not changed.')
      break
    }
    if (attempt === 59)
      throw new Error('Replica set initialization timed out. Check the library MongoDB log.')
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
} finally {
  await client?.close()
}
