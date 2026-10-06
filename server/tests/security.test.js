import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import request from 'supertest'
import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { app } from '../app.js'
import { User, Audit, allModels } from '../models.js'

let mongo
let adminToken, librarianToken, memberToken, otherToken
let adminId, memberId
const password = 'Library-testing-password-2026'
const auth = (token) => ({ Authorization: `Bearer ${token}` })
const login = (email, pass = password) =>
  request(app).post('/api/auth/login').send({ email, password: pass })

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  await mongoose.connect(mongo.getUri('biblioteca-security-test'))
  for (const model of allModels) await model.init()
})
afterAll(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
})
beforeEach(async () => {
  for (const model of allModels) await model.collection.deleteMany({})
  const passwordHash = await argon2.hash(password)
  const users = await User.create([
    { name: 'Admin', email: 'admin@test.local', passwordHash, role: 'admin' },
    { name: 'Staff', email: 'staff@test.local', passwordHash, role: 'librarian' },
    { name: 'Amina', email: 'amina@test.local', passwordHash },
    { name: 'David', email: 'david@test.local', passwordHash },
  ])
  ;[adminId, , memberId] = users.map((user) => String(user._id))
  const tokens = []
  for (const user of users) tokens.push((await login(user.email)).body.accessToken)
  ;[adminToken, librarianToken, memberToken, otherToken] = tokens
})

describe('injection and malformed input', () => {
  it('rejects operator objects in sign-in, query strings and bodies', async () => {
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: { $ne: null }, password: { $ne: null } })
      ).status,
    ).toBe(400)
    expect((await request(app).get('/api/books?q[$ne]=x')).status).toBeLessThan(500)
    expect((await request(app).get('/api/books?category[$ne]=x')).status).toBeLessThan(500)
    expect((await request(app).get('/api/books?category=not-an-id')).status).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: { $gt: '' } })
      ).status,
    ).toBe(400)
    // Express reads `from[$gt]` as a plain key, so it is ignored rather than run as an operator.
    expect(
      (await request(app).get('/api/staff/reports/run/fines?from[$gt]=1').set(auth(adminToken)))
        .status,
    ).toBeLessThan(500)
  })

  it('treats search text literally, not as a regular expression', async () => {
    const response = await request(app).get('/api/books?q=.*')
    expect(response.status).toBe(200)
    expect(response.body.total).toBe(0)
  })

  it('rejects broken JSON and oversized bodies without leaking details', async () => {
    const broken = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
    expect(broken.status).toBe(400)
    const huge = await request(app)
      .post('/api/contact')
      .send({ message: 'x'.repeat(200_000) })
    expect(huge.status).toBe(413)
    expect(JSON.stringify(huge.body)).not.toMatch(/stack|node_modules/i)
  })

  it('returns a generic error for unknown routes and never a stack trace', async () => {
    const response = await request(app).get('/api/nope').set(auth(memberToken))
    expect(response.status).toBe(404)
    expect(JSON.stringify(response.body)).not.toMatch(/at .*\.js/)
  })
})

describe('secrets and privacy', () => {
  it('never exposes password hashes or token secrets', async () => {
    const calls = [
      request(app).get('/api/me').set(auth(memberToken)),
      request(app).get('/api/staff/members').set(auth(librarianToken)),
      request(app).get('/api/staff/members?group=team').set(auth(adminToken)),
      login('amina@test.local'),
    ]
    for (const response of await Promise.all(calls)) {
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$argon2/)
    }
  })

  it('does not reveal whether an email has an account', async () => {
    const unknown = await login('nobody@test.local', 'wrong-password-123')
    const known = await login('amina@test.local', 'wrong-password-123')
    expect(unknown.status).toBe(401)
    expect(known.status).toBe(401)
    expect(unknown.body.message).toBe(known.body.message)
    const reset = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.local' })
    const resetKnown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'amina@test.local' })
    expect(reset.body.message).toBe(resetKnown.body.message)
  })

  it('sets the refresh cookie HttpOnly and SameSite=Strict', async () => {
    const response = await login('amina@test.local')
    const cookie = response.headers['set-cookie'].join(';')
    expect(cookie).toMatch(/refreshToken=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Strict/i)
    expect(JSON.stringify(response.body)).not.toMatch(/refreshToken/)
  })

  it('records sign-ins in the audit log', async () => {
    const before = await Audit.countDocuments({ action: 'user.login' })
    await login('amina@test.local')
    expect(await Audit.countDocuments({ action: 'user.login' })).toBe(before + 1)
    await login('amina@test.local', 'wrong-password-123')
    expect(await Audit.countDocuments({ action: 'user.login' })).toBe(before + 1)
  })
})

describe('privilege escalation', () => {
  it('ignores a role sent in a profile update', async () => {
    const response = await request(app)
      .patch('/api/me')
      .set(auth(memberToken))
      .send({ name: 'Amina', role: 'admin' })
    expect(response.status).toBe(200)
    expect((await User.findById(memberId)).role).toBe('member')
  })

  it('stops librarians creating staff or promoting anyone', async () => {
    const create = await request(app)
      .post('/api/staff/members')
      .set(auth(librarianToken))
      .send({ name: 'Sneaky Admin', email: 'sneaky@test.local', password, role: 'admin' })
    expect(create.status).toBe(403)
    const promote = await request(app)
      .patch(`/api/staff/members/${memberId}`)
      .set(auth(librarianToken))
      .send({ name: 'Amina', status: 'active', role: 'admin' })
    expect(promote.status).toBe(403)
    expect((await User.findById(memberId)).role).toBe('member')
  })

  it('stops an administrator demoting or suspending their own account', async () => {
    const response = await request(app)
      .patch(`/api/staff/members/${adminId}`)
      .set(auth(adminToken))
      .send({ name: 'Admin', status: 'suspended', role: 'admin' })
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect((await User.findById(adminId)).status).toBe('active')
  })

  it('keeps members out of every staff area', async () => {
    for (const path of [
      '/api/staff/members',
      '/api/staff/books',
      '/api/staff/reports',
      '/api/staff/audit',
      '/api/staff/policies',
      '/api/staff/email',
      '/api/staff/applications',
      '/api/staff/content?kind=news',
      '/api/staff/categories',
      '/api/fines/summary',
    ]) {
      const response = await request(app).get(path).set(auth(memberToken))
      expect(response.status, path).toBe(403)
      expect((await request(app).get(path)).status, `${path} signed out`).toBe(401)
    }
  })
})

describe('sessions', () => {
  it('rejects a token once the account is suspended', async () => {
    expect((await request(app).get('/api/me').set(auth(otherToken))).status).toBe(200)
    await User.updateOne({ email: 'david@test.local' }, { $set: { status: 'suspended' } })
    expect((await request(app).get('/api/me').set(auth(otherToken))).status).toBe(401)
    expect((await login('david@test.local')).status).toBe(401)
  })

  it('rejects forged, tampered and missing tokens', async () => {
    const [header, payload, signature] = memberToken.split('.')
    const forged = `${header}.${Buffer.from(JSON.stringify({ sub: adminId, version: 0 })).toString('base64url')}.${signature}`
    for (const token of [
      forged,
      `${header}.${payload}.`,
      'garbage',
      `${header}.${payload}.${signature}x`,
    ]) {
      expect((await request(app).get('/api/me').set(auth(token))).status).toBe(401)
    }
    expect((await request(app).get('/api/me')).status).toBe(401)
  })

  it('refuses state-changing requests from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/contact')
      .set('Origin', 'https://evil.example')
      .send({ name: 'x', email: 'x@x.com', subject: 'Other', message: 'hello there friend' })
    expect(response.status).toBe(403)
  })

  it('changes sessions when the password changes', async () => {
    const response = await request(app).patch('/api/me').set(auth(memberToken)).send({
      name: 'Amina',
      currentPassword: password,
      password: 'A-brand-new-password-2026',
      confirmPassword: 'A-brand-new-password-2026',
    })
    expect(response.status).toBe(200)
    expect((await request(app).get('/api/me').set(auth(memberToken))).status).toBe(401)
  })
})

describe('health and production configuration', () => {
  it('reports health without leaking details', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-powered-by']).toBeUndefined()
    expect(response.headers['x-content-type-options']).toBe('nosniff')
  })

  const start = (env) =>
    spawnSync(process.execPath, ['-e', "import('./server/config/env.js')"], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ...env },
    })
  const good = {
    NODE_ENV: 'production',
    JWT_SECRET: 'f3a9c1d27b5e4a60918d7c2b3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster0.example.mongodb.net/library',
    CLIENT_ORIGIN: 'https://library.example.org',
  }

  it('accepts a complete production configuration', () => {
    expect(start(good).status).toBe(0)
  })

  it('accepts a local MongoDB replica set in production', () => {
    const local = {
      ...good,
      MONGODB_URI: 'mongodb://127.0.0.1:27018/biblioteca?replicaSet=biblioteca-rs',
    }
    expect(start(local).status).toBe(0)
  })

  it('refuses placeholder secrets, a missing database address and non-https origins in production', () => {
    for (const bad of [
      { JWT_SECRET: 'replace-with-a-random-secret-of-at-least-32-characters' },
      // Empty rather than absent: dotenv would otherwise fill it from a developer's server/.env.
      { MONGODB_URI: '' },
      { CLIENT_ORIGIN: 'http://library.example.org' },
    ]) {
      const env = { ...good, ...bad }
      for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key]
      const result = start(env)
      expect(result.status, JSON.stringify(bad)).toBe(1)
      expect(result.stderr).toMatch(/Invalid production configuration/)
    }
  })

  it('does not apply those production rules in development', () => {
    const result = start({
      NODE_ENV: 'development',
      JWT_SECRET: 'replace-with-a-random-secret-of-at-least-32-characters',
    })
    expect(result.status).toBe(0)
  })
})
