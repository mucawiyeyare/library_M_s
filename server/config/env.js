import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
// Always load server configuration, regardless of the terminal working directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
import { z } from 'zod'
const environment = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27018/biblioteca?replicaSet=biblioteca-rs'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  MAIL_TRANSPORT: z.enum(['preview', 'smtp']).default('preview'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  // Number of reverse proxies in front of the API (so rate limits see each visitor's real IP).
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  // Serve the built website (client/dist) from this server: one service, one origin.
  SERVE_CLIENT: z.enum(['true', 'false']).default('false'),
})
export const config = environment.parse(process.env)
// Production refuses to start with placeholder or local-only settings.
if (config.NODE_ENV === 'production') {
  const problems = []
  if (/replace-with|change-?me|your-secret|example|password/i.test(config.JWT_SECRET))
    problems.push('JWT_SECRET looks like a placeholder; generate a random one.')
  if (!process.env.MONGODB_URI)
    problems.push(
      'MONGODB_URI must be set to your MongoDB replica set (for example the local one from npm run db:start).',
    )
  if (!config.CLIENT_ORIGIN.startsWith('https://'))
    problems.push('CLIENT_ORIGIN must be the public https:// address of the website.')
  if (problems.length) {
    console.error('Invalid production configuration:\n- ' + problems.join('\n- '))
    process.exit(1)
  }
}
