import express from 'express';
import { Notification, Complaint, ActivityLog } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';

const router = express.Router();
router.use('/notifications', createCrudRouter(Notification, { filterFields: ['recipient', 'isRead', 'type'], searchableFields: ['title', 'message'] }));
router.use('/complaints', createCrudRouter(Complaint, { filterFields: ['customer', 'order', 'status'], searchableFields: ['subject', 'message'] }));
router.use('/activity-logs', createCrudRouter(ActivityLog, { filterFields: ['actor', 'actorRole', 'resourceType', 'action'] }));
export default router;
