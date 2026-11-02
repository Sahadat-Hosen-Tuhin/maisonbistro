import express from 'express';
import { InventoryItem, InventoryMovement, Purchase, Expense } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';

const router = express.Router();
router.use('/items', createCrudRouter(InventoryItem, { filterFields: ['category', 'isActive'], searchableFields: ['name'] }));
router.use('/movements', createCrudRouter(InventoryMovement, { filterFields: ['item', 'type', 'source'] }));
router.use('/purchases', createCrudRouter(Purchase, { filterFields: ['item', 'category', 'status', 'createdBy'], searchableFields: ['itemName', 'supplierName'] }));
router.use('/expenses', createCrudRouter(Expense, { filterFields: ['category', 'createdBy'], searchableFields: ['description'] }));
export default router;
