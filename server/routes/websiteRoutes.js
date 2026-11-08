import express from 'express';
import {
  getWebsites,
  getWebsiteById,
  createWebsite,
  updateWebsite,
  deleteWebsite,
  triggerCheck,
  toggleMonitoring,
  exportHistoryCsv
} from '../controllers/websiteController.js';
import { getWebsiteHistory, getWebsiteAnalytics } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getWebsites)
  .post(createWebsite);

router.route('/:id')
  .get(getWebsiteById)
  .put(updateWebsite)
  .delete(deleteWebsite);

router.post('/:id/check', triggerCheck);
router.patch('/:id/monitoring', toggleMonitoring);
router.get('/:id/export-csv', exportHistoryCsv);
router.get('/:id/history', getWebsiteHistory);
router.get('/:id/analytics', getWebsiteAnalytics);

export default router;
