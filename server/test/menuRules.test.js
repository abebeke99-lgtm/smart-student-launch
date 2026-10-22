const test = require('node:test');
const assert = require('node:assert/strict');
const { isMenuItemOrderable } = require('../src/utils/menuRules');

test('orderable menu item must be available, published, and in an active category', () => {
  assert.equal(isMenuItemOrderable({
    isAvailable: true,
    isPublished: true,
    category: { isActive: true },
  }), true);
  assert.equal(isMenuItemOrderable({
    isAvailable: false,
    isPublished: true,
    category: { isActive: true },
  }), false);
  assert.equal(isMenuItemOrderable({
    isAvailable: true,
    isPublished: false,
    category: { isActive: true },
  }), false);
  assert.equal(isMenuItemOrderable({
    isAvailable: true,
    isPublished: true,
    category: { isActive: false },
  }), false);
});

test('legacy items without explicit publication and category activation remain orderable', () => {
  assert.equal(isMenuItemOrderable({
    isAvailable: true,
    category: {},
  }), true);
});
