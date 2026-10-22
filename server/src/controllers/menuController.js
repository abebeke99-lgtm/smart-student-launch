const mongoose = require('mongoose');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');
const logAdminChange = require('../utils/activityLogger');
const { removeLocalImage, removeUploadedFile } = require('../utils/imageFiles');

function getImageUrl(req) {
  if (req.file) return `/uploads/${req.file.filename}`;
  return req.body.imageUrl;
}

function getMenuChanges(req) {
  const changes = {};
  for (const field of ['name', 'description', 'price', 'category', 'isAvailable', 'isPublished', 'preparationTime']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }
  const imageUrl = getImageUrl(req);
  if (imageUrl !== undefined) changes.imageUrl = imageUrl;
  return changes;
}

async function ensureCategoryExists(categoryId) {
  if (categoryId && !(await Category.exists({ _id: categoryId }))) {
    throw new AppError('Category not found', 400);
  }
}

async function listMenu(req, res) {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const filter = {};
  if (req.user?.role !== 'admin') {
    filter.isPublished = { $ne: false };
    const activeCategories = await Category.find({ isActive: { $ne: false } }).select('_id');
    filter.category = { $in: activeCategories.map((category) => category._id) };
  }

  if (req.query.search) {
    const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escapedSearch, $options: 'i' };
  }
  const categoryId = req.query.category || req.query.categoryId;
  if (categoryId) {
    const category = new mongoose.Types.ObjectId(categoryId);
    if (req.user?.role !== 'admin' && !(await Category.exists({ _id: category, isActive: { $ne: false } }))) {
      filter._id = null;
    } else {
      filter.category = category;
    }
  }

  const availability = req.query.availability ?? req.query.isAvailable;
  if (availability !== undefined) filter.isAvailable = availability === 'true';

  const [items, totalItems] = await Promise.all([
    MenuItem.find(filter)
      .populate('category', 'name')
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MenuItem.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: { items },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  });
}

async function getMenuItem(req, res) {
  const item = await MenuItem.findById(req.params.id).populate('category', 'name description isActive');
  if (!item) throw new AppError('Menu item not found', 404);
  if (req.user?.role !== 'admin'
    && (item.isPublished === false || item.category?.isActive === false)) {
    throw new AppError('Menu item not found', 404);
  }
  return res.status(200).json({ success: true, data: { item } });
}

async function createMenuItem(req, res) {
  let itemCreated = false;
  try {
    const values = getMenuChanges(req);
    await ensureCategoryExists(values.category);
    const item = await MenuItem.create(values);
    itemCreated = true;
    await logAdminChange(req, 'menu_item_created', 'MenuItem', item._id, {
      name: item.name,
      category: item.category,
    });
    return res.status(201).json({ success: true, data: { item } });
  } catch (error) {
    if (!itemCreated) await removeUploadedFile(req.file);
    throw error;
  }
}

async function updateMenuItem(req, res) {
  let itemSaved = false;
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) throw new AppError('Menu item not found', 404);

    const previousImageUrl = item.imageUrl;
    const changes = getMenuChanges(req);
    await ensureCategoryExists(changes.category);
    Object.assign(item, changes);
    await item.save();
    itemSaved = true;
    await logAdminChange(req, 'menu_item_updated', 'MenuItem', item._id, {
      fields: Object.keys(changes).filter((field) => field !== 'imageUrl'),
      imageChanged: changes.imageUrl !== undefined,
    });
    if (changes.imageUrl !== undefined && previousImageUrl !== changes.imageUrl) {
      await removeLocalImage(previousImageUrl);
    }
    return res.status(200).json({ success: true, data: { item } });
  } catch (error) {
    if (!itemSaved) await removeUploadedFile(req.file);
    throw error;
  }
}

async function deleteMenuItem(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new AppError('Menu item not found', 404);

  await item.deleteOne();
  await logAdminChange(req, 'menu_item_deleted', 'MenuItem', item._id, {
    name: item.name,
  });
  await removeLocalImage(item.imageUrl);

  return res.status(200).json({ success: true, message: 'Menu item deleted' });
}

async function toggleAvailability(req, res) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new AppError('Menu item not found', 404);

  item.isAvailable = req.body.isAvailable;
  await item.save();
  await logAdminChange(req, 'menu_item_availability_changed', 'MenuItem', item._id, {
    isAvailable: item.isAvailable,
  });

  return res.status(200).json({ success: true, data: { item } });
}

module.exports = {
  listMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
};
