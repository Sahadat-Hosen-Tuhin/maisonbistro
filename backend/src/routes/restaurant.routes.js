import express from 'express';
import { Floor, RestaurantTable, RestaurantSettings } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';

const router = express.Router();
router.use('/floors', createCrudRouter(Floor, { filterFields: ['isActive'], searchableFields: ['name'] }));
router.use('/tables', createCrudRouter(RestaurantTable, { filterFields: ['floor', 'status', 'isActive'], searchableFields: ['name'] }));
router.use('/settings', createCrudRouter(RestaurantSettings, { searchableFields: ['restaurantName'] }));
export default router;
