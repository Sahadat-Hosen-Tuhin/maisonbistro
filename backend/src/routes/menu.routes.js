import express from 'express';
import { FoodCategory, FoodItem, FoodReview, Coupon } from '../models/index.js';
import { createCrudRouter } from '../utils/crudRouter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { allowRoles, requireAuth } from '../middlewares/auth.js';
import { menuImageUpload } from '../config/uploads.js';

const router = express.Router();
const managementRouter = express.Router();
managementRouter.use(requireAuth, allowRoles('admin', 'owner', 'manager'));
const allowedSizes = ['small', 'medium', 'large', '9_inch', '10_inch', '11_inch', '12_inch', 'family'];
const allowedDietary = ['vegetarian', 'vegan', 'spicy', 'gluten_free', 'meat_lovers'];
const allowedMealTimes = ['breakfast', 'snacks', 'dinner', 'late_night'];
const allowedSpicyLevels = ['25_percent', '50_percent', '75_percent', 'super_duper_naga'];
function toSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function slugPattern(value) {
  return toSlug(value).split('-').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ -]+');
}

function parseArray(value, allowedValues, fieldName) {
  if (value === undefined) return undefined;
  let values;
  try {
    values = Array.isArray(value) ? value : JSON.parse(value);
  } catch {
    const error = new Error(`${fieldName} must be a valid list`);
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(values) || values.some((entry) => !allowedValues.includes(entry))) {
    const error = new Error(`Invalid ${fieldName} value`);
    error.statusCode = 400;
    throw error;
  }
  return values;
}

function parseSizePricing(value) {
  if (value === undefined) return undefined;
  let entries;
  try {
    entries = Array.isArray(value) ? value : JSON.parse(value);
  } catch {
    const error = new Error('sizePricing must be a valid list');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(entries) || entries.some((entry) => (
    !entry || !allowedSizes.includes(entry.size) ||
    Number.isNaN(Number(entry.adjustment))
  ))) {
    const error = new Error('Invalid sizePricing value');
    error.statusCode = 400;
    throw error;
  }
  return entries.map((entry) => ({ size: entry.size, adjustment: Number(entry.adjustment) }));
}

managementRouter.get('/categories', asyncHandler(async (_request, response) => {
  response.json({ data: await FoodCategory.find().sort({ name: 1 }) });
}));

managementRouter.post('/categories', menuImageUpload.single('image'), asyncHandler(async (request, response) => {
  const { name, description, isVisible, isActive } = request.body;
  if (!name?.trim()) return response.status(400).json({ message: 'Category name is required' });
  const category = await FoodCategory.create({
    name: name.trim(), slug: toSlug(name), description,
    image: request.file ? `/uploads/menu/${request.file.filename}` : undefined,
    availableSizes: parseArray(request.body.availableSizes, allowedSizes, 'availableSizes'),
    isVisible, isActive
  });
  response.status(201).json({ data: category });
}));

managementRouter.patch('/categories/:id', menuImageUpload.single('image'), asyncHandler(async (request, response) => {
  const updates = { ...request.body };
  if (request.body.name) updates.slug = toSlug(request.body.name);
  if (request.body.availableSizes !== undefined) updates.availableSizes = parseArray(request.body.availableSizes, allowedSizes, 'availableSizes');
  if (request.file) updates.image = `/uploads/menu/${request.file.filename}`;
  const category = await FoodCategory.findByIdAndUpdate(request.params.id, updates, {
    new: true, runValidators: true
  });
  if (!category) return response.status(404).json({ message: 'Category not found' });
  response.json({ data: category });
}));

managementRouter.delete('/categories/:id', asyncHandler(async (request, response) => {
  const itemCount = await FoodItem.countDocuments({ category: request.params.id });
  if (itemCount) return response.status(409).json({ message: 'Move or delete food items in this category first' });
  const category = await FoodCategory.findByIdAndDelete(request.params.id);
  if (!category) return response.status(404).json({ message: 'Category not found' });
  response.status(204).send();
}));

managementRouter.get('/items', asyncHandler(async (_request, response) => {
  response.json({ data: await FoodItem.find().populate('category', 'name').sort({ createdAt: -1 }) });
}));

managementRouter.post('/items', menuImageUpload.single('image'), asyncHandler(async (request, response) => {
  const data = { ...request.body };
  if (request.body.name) data.slug = toSlug(request.body.name);
  delete data.image;
  data.availableSizes = parseArray(request.body.availableSizes, allowedSizes, 'availableSizes');
  data.dietary = parseArray(request.body.dietary, allowedDietary, 'dietary');
  data.mealTimes = parseArray(request.body.mealTimes, allowedMealTimes, 'mealTimes');
  data.sizePricing = parseSizePricing(request.body.sizePricing);
  data.spicyLevels = parseArray(request.body.spicyLevels, allowedSpicyLevels, 'spicyLevels');
  if (data.spicyLevels?.length && !data.dietary?.includes('spicy')) {
    return response.status(400).json({ message: 'Select Spicy dietary option before adding spicy levels' });
  }
  if (request.file) data.image = `/uploads/menu/${request.file.filename}`;
  const item = await FoodItem.create(data);
  response.status(201).json({ data: await item.populate('category', 'name') });
}));

managementRouter.patch('/items/:id', menuImageUpload.single('image'), asyncHandler(async (request, response) => {
  const existingItem = await FoodItem.findById(request.params.id);
  if (!existingItem) return response.status(404).json({ message: 'Food item not found' });
  const updates = { ...request.body };
  if (request.body.name) updates.slug = toSlug(request.body.name);
  delete updates.image;
  if (request.body.availableSizes !== undefined) updates.availableSizes = parseArray(request.body.availableSizes, allowedSizes, 'availableSizes');
  if (request.body.dietary !== undefined) updates.dietary = parseArray(request.body.dietary, allowedDietary, 'dietary');
  if (request.body.mealTimes !== undefined) updates.mealTimes = parseArray(request.body.mealTimes, allowedMealTimes, 'mealTimes');
  if (request.body.sizePricing !== undefined) updates.sizePricing = parseSizePricing(request.body.sizePricing);
  if (request.body.spicyLevels !== undefined) updates.spicyLevels = parseArray(request.body.spicyLevels, allowedSpicyLevels, 'spicyLevels');
  const resultingDietary = updates.dietary || existingItem.dietary;
  const resultingSpicyLevels = updates.spicyLevels || existingItem.spicyLevels;
  if (resultingSpicyLevels?.length && !resultingDietary?.includes('spicy')) {
    return response.status(400).json({ message: 'Select Spicy dietary option before adding spicy levels' });
  }
  if (request.file) updates.image = `/uploads/menu/${request.file.filename}`;
  const item = await FoodItem.findByIdAndUpdate(request.params.id, updates, {
    new: true, runValidators: true
  }).populate('category', 'name');
  response.json({ data: item });
}));

managementRouter.delete('/items/:id', asyncHandler(async (request, response) => {
  const item = await FoodItem.findByIdAndDelete(request.params.id);
  if (!item) return response.status(404).json({ message: 'Food item not found' });
  response.status(204).send();
}));

router.use('/manage', managementRouter);
router.get('/categories/slug/:slug', asyncHandler(async (request, response) => {
  const category = await FoodCategory.findOne({
    $or: [{ slug: request.params.slug }, { name: { $regex: `^${slugPattern(request.params.slug)}$`, $options: 'i' } }]
  });
  if (!category) return response.status(404).json({ message: 'Category not found' });
  const items = await FoodItem.find({ category: category._id, isAvailable: true }).populate('category', 'name slug').sort({ isFeatured: -1, isBestSeller: -1, name: 1 });
  response.json({ data: { category, items } });
}));
router.get('/items/slug/:slug', asyncHandler(async (request, response) => {
  const item = await FoodItem.findOne({
    $or: [{ slug: request.params.slug }, { name: { $regex: `^${slugPattern(request.params.slug)}$`, $options: 'i' } }],
    isAvailable: true
  }).populate('category', 'name slug');
  if (!item) return response.status(404).json({ message: 'Menu item not found' });
  response.json({ data: item });
}));
router.use('/categories', createCrudRouter(FoodCategory, { searchableFields: ['name', 'description'] }));
router.use('/items', createCrudRouter(FoodItem, { filterFields: ['category', 'isAvailable', 'isFeatured', 'isBestSeller'], searchableFields: ['name', 'description'], populate: 'category' }));
router.use('/reviews', createCrudRouter(FoodReview, { filterFields: ['foodItem', 'customer', 'isVisible'] }));
router.use('/coupons', createCrudRouter(Coupon, { filterFields: ['isActive'], searchableFields: ['code', 'description'] }));
export default router;
