import express from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from './asyncHandler.js';

function getId(request) {
  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid resource id');
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export function createCrudRouter(Model, options = {}) {
  const router = express.Router();
  const searchableFields = options.searchableFields || [];

  router.get('/', asyncHandler(async (request, response) => {
    const page = Math.max(Number(request.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
    const filter = {};
    for (const field of options.filterFields || []) {
      if (request.query[field] !== undefined) filter[field] = request.query[field];
    }
    if (request.query.search && searchableFields.length) {
      filter.$or = searchableFields.map((field) => ({ [field]: { $regex: request.query.search, $options: 'i' } }));
    }
    const [items, total] = await Promise.all([
      (options.populate ? Model.find(filter).populate(options.populate) : Model.find(filter))
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Model.countDocuments(filter)
    ]);
    response.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const item = await Model.create(request.body);
    response.status(201).json({ data: item });
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const item = await Model.findById(getId(request));
    if (!item) return response.status(404).json({ message: 'Resource not found' });
    response.json({ data: item });
  }));

  router.patch('/:id', asyncHandler(async (request, response) => {
    const item = await Model.findByIdAndUpdate(getId(request), request.body, {
      new: true, runValidators: true
    });
    if (!item) return response.status(404).json({ message: 'Resource not found' });
    response.json({ data: item });
  }));

  router.delete('/:id', asyncHandler(async (request, response) => {
    const item = await Model.findByIdAndDelete(getId(request));
    if (!item) return response.status(404).json({ message: 'Resource not found' });
    response.status(204).send();
  }));

  return router;
}
