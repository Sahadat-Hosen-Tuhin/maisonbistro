import express from 'express';
import { Attendance, PerformanceRecord, SalaryPayment, KitchenOrder, DeliveryAssignment, CleaningTask } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';

const router = express.Router();
router.use('/attendance', createCrudRouter(Attendance, { filterFields: ['employee', 'status', 'approval.status'] }));
router.use('/performance', createCrudRouter(PerformanceRecord, { filterFields: ['employee'] }));
router.use('/salary', createCrudRouter(SalaryPayment, { filterFields: ['employee', 'salaryMonth', 'status'] }));
router.use('/kitchen-orders', createCrudRouter(KitchenOrder, { filterFields: ['assignedChef', 'status', 'priority'] }));
router.use('/deliveries', createCrudRouter(DeliveryAssignment, { filterFields: ['staff', 'status'] }));
router.use('/cleaning-tasks', createCrudRouter(CleaningTask, { filterFields: ['assignedTo', 'status', 'priority'], searchableFields: ['title', 'area'] }));
export default router;
