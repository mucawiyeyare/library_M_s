import { startEmailWorker } from './features/email/email.worker.js'
import mongoose from 'mongoose'
import { app } from './app.js'
import { config } from './config/env.js'
import { allModels } from './models.js'
import { getPolicy } from './features/policies/policy.model.js'
import { Book } from './features/inventory/book.model.js'
import { linkCatalogReferences } from './features/taxonomy/book-links.js'
import { startReservationWorker } from './features/reservations/reservation.service.js'
import { seedCatalog } from './scripts/seed.js'
try {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  const hello = await mongoose.connection.db.admin().command({ hello: 1 })
  if (!hello.setName && hello.msg !== 'isdbgrid')
    throw new Error('MongoDB must run as a replica set for library transactions')
  for (const model of allModels) await model.init()
  await getPolicy()
  await linkCatalogReferences()
  if (config.NODE_ENV === 'development' && (await Book.estimatedDocumentCount()) === 0) {
    await seedCatalog()
    console.log('Empty development catalog: sample books inserted.')
  }
  const stopEmailWorker = startEmailWorker()
  const stopReservationWorker = startReservationWorker()
  const server = app.listen(config.PORT, () =>
    console.log(`Biblioteca API listening on http://localhost:${config.PORT}`),
  )
  const stop = () => {
    stopEmailWorker()
    stopReservationWorker()
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0))
    })
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
} catch (error) {
  console.error('API startup failed:', error)
  process.exitCode = 1
}
