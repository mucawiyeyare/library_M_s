import {
  getBooks,
  postBooks,
  patchBooksId,
  getCopies,
  postBooksIdCopies,
  patchCopiesId,
} from './inventory.controller.js'
import express from 'express'
import { authenticate, authorize } from '../../shared/middleware/auth.js'
const router = express.Router()
router.use(authenticate)
router.use(authorize('librarian', 'admin'))
router.get('/books', getBooks)
router.post('/books', postBooks)
router.patch('/books/:id', patchBooksId)
router.get('/copies', getCopies)
router.post('/books/:id/copies', postBooksIdCopies)
router.patch('/copies/:id', patchCopiesId)
export default router
