const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');
const logAdminChange = require('../utils/activityLogger');

async function ensureUniqueCategoryName(name, excludedId) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Category.findOne({
    name: { $regex: `^${escapedName}$`, $options: 'i' },
    ...(excludedId ? { _id: { $ne: excludedId } } : {}),
  }).select('_id');
  if (existing) throw new AppError('A category with this name already exists', 409);
}

async function listCategories(req, res) {
  const filter = req.user?.role === 'admin' ? {} : { isActive: { $ne: false } };
  const categories = await Category.find(filter).sort({ name: 1 });
  return res.status(200).json({
    success: true,
    data: { categories },
  });
}

async function createCategory(req, res) {
  await ensureUniqueCategoryName(req.body.name);
  const category = await Category.create({
    name: req.body.name,
    description: req.body.description,
  });
  await logAdminChange(req, 'category_created', 'Category', category._id, {
    name: category.name,
  });

  return res.status(201).json({ success: true, data: { category } });
}

async function updateCategory(req, res) {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  const changes = {};
  if (req.body.name !== undefined) changes.name = req.body.name;
  if (req.body.description !== undefined) changes.description = req.body.description;
  if (req.body.isActive !== undefined) changes.isActive = req.body.isActive;
  if (changes.name !== undefined) await ensureUniqueCategoryName(changes.name, category._id);
  Object.assign(category, changes);
  await category.save();
  await logAdminChange(req, 'category_updated', 'Category', category._id, {
    fields: Object.keys(changes),
  });

  return res.status(200).json({ success: true, data: { category } });
}

async function deleteCategory(req, res) {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  const hasMenuItems = await MenuItem.exists({ category: category._id });
  if (hasMenuItems) {
    throw new AppError('Cannot delete a category that still has menu items', 409);
  }

  await category.deleteOne();
  await logAdminChange(req, 'category_deleted', 'Category', category._id, {
    name: category.name,
  });

  return res.status(200).json({
    success: true,
    message: 'Category deleted',
  });
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
