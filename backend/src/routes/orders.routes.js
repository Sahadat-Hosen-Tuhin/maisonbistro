import express from 'express';
import { Order, Invoice, Payment } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';

const router = express.Router();
router.use('/orders', createCrudRouter(Order, { filterFields: ['customer', 'type', 'status', 'paymentStatus'], searchableFields: ['orderNumber', 'guest.name', 'guest.phone'] }));
router.use('/invoices', createCrudRouter(Invoice, { searchableFields: ['invoiceNumber'] }));
router.use('/payments', createCrudRouter(Payment, { filterFields: ['order', 'method', 'status', 'receivedBy'] }));
export default router;
