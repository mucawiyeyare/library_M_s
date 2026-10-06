import mongoose from 'mongoose'
import * as argon2 from '@node-rs/argon2'
import { config } from '../config/env.js'
import { registerSchema } from '../contracts/schemas.js'
import { User } from '../features/members/user.model.js'
import { Audit } from '../features/audit/audit.model.js'
try {
  const input = registerSchema.parse({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  })
  await mongoose.connect(config.MONGODB_URI)
  await User.init()
  if (await User.exists({ role: 'admin' }))
    throw new Error(
      'An administrator already exists. Use authenticated member management for further role changes.',
    )
  const admin = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await argon2.hash(input.password),
    role: 'admin',
  })
  await Audit.create({ actor: admin._id, action: 'admin.bootstrapped', entity: String(admin._id) })
  console.log('Administrator created. Sign in using the configured email and password.')
} finally {
  await mongoose.disconnect()
}
