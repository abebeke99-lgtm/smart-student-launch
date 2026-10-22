const Cart = require('../models/Cart');
const MenuItem = require('../models/MenuItem');
const { isMenuItemOrderable } = require('../utils/menuRules');
const AppError = require('../utils/AppError');

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (cart) return cart;

  try {
    cart = await Cart.create({ user: userId, items: [] });
    return cart;
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Cart.findOne({ user: userId });
  }
}

async function populateAndPriceCart(cart) {
  await cart.populate({
    path: 'items.menuItem',
    select: 'name description price imageUrl category isAvailable isPublished preparationTime',
    populate: { path: 'category', select: 'name isActive' },
  });

  let changed = false;
  const validItems = [];
  for (const item of cart.items) {
    if (!item.menuItem) {
      changed = true;
      continue;
    }
    if (item.price !== item.menuItem.price) {
      item.price = item.menuItem.price;
      changed = true;
    }
    validItems.push(item);
  }
  if (changed) {
    cart.items = validItems;
    await cart.save();
  }

  const items = cart.items.map((item) => ({
    menuItem: item.menuItem,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.price * item.quantity,
  }));
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: cart._id,
    items,
    total,
    updatedAt: cart.updatedAt,
  };
}

async function findAvailableMenuItem(menuItemId) {
  const menuItem = await MenuItem.findById(menuItemId).populate('category', 'isActive');
  if (!menuItem) throw new AppError('Menu item not found', 404);
  if (!isMenuItemOrderable(menuItem)) throw new AppError('Menu item is not currently available to order', 409);
  return menuItem;
}

async function getCart(req, res) {
  const cart = await getOrCreateCart(req.user._id);
  const responseCart = await populateAndPriceCart(cart);
  return res.status(200).json({ success: true, data: { cart: responseCart } });
}

async function addCartItem(req, res) {
  const { menuItemId, quantity } = req.body;
  const menuItem = await findAvailableMenuItem(menuItemId);
  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find((item) => item.menuItem.toString() === menuItemId);
  const resultingQuantity = (existingItem?.quantity || 0) + quantity;

  if (resultingQuantity > 20) {
    throw new AppError('An item quantity cannot exceed 20', 400);
  }

  if (existingItem) {
    existingItem.quantity = resultingQuantity;
    existingItem.price = menuItem.price;
  } else {
    cart.items.push({
      menuItem: menuItem._id,
      quantity,
      price: menuItem.price,
    });
  }
  await cart.save();

  const responseCart = await populateAndPriceCart(cart);
  return res.status(200).json({ success: true, data: { cart: responseCart } });
}

async function updateCartItem(req, res) {
  const { menuItemId } = req.params;
  const menuItem = await findAvailableMenuItem(menuItemId);
  const cart = await Cart.findOne({ user: req.user._id });
  const cartItem = cart?.items.find((item) => item.menuItem.toString() === menuItemId);
  if (!cartItem) throw new AppError('Cart item not found', 404);

  cartItem.quantity = req.body.quantity;
  cartItem.price = menuItem.price;
  await cart.save();

  const responseCart = await populateAndPriceCart(cart);
  return res.status(200).json({ success: true, data: { cart: responseCart } });
}

async function removeCartItem(req, res) {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = cart.items.filter((item) => item.menuItem.toString() !== req.params.menuItemId);
    await cart.save();
  }

  const responseCart = cart
    ? await populateAndPriceCart(cart)
    : { id: null, items: [], total: 0, updatedAt: null };
  return res.status(200).json({ success: true, data: { cart: responseCart } });
}

async function clearCart(req, res) {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }

  return res.status(200).json({
    success: true,
    data: {
      cart: cart
        ? { id: cart._id, items: [], total: 0, updatedAt: cart.updatedAt }
        : { id: null, items: [], total: 0, updatedAt: null },
    },
  });
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
};
