import express from 'express';
import { getDashboardOverview } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/overview', getDashboardOverview);

export default router;
