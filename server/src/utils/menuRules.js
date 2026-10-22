function isMenuItemOrderable(item) {
  return item.isAvailable !== false
    && item.isPublished !== false
    && item.category?.isActive !== false;
}

module.exports = { isMenuItemOrderable };
