import { getList, getId, getStats, getHome } from './catalog.controller.js'
import express from 'express'
const router = express.Router()
router.get('/stats', getStats)
router.get('/home', getHome)
router.get('/', getList)
router.get('/:id', getId)
export default router
