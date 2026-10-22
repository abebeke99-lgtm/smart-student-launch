const test = require('node:test');
const assert = require('node:assert/strict');
const { canTransition, calculateSubtotal } = require('../src/utils/orderRules');

test('order status progression permits only adjacent workflow transitions', () => {
  assert.equal(canTransition('pending', 'confirmed'), true);
  assert.equal(canTransition('confirmed', 'preparing'), true);
  assert.equal(canTransition('preparing', 'ready'), true);
  assert.equal(canTransition('ready', 'served'), true);
  assert.equal(canTransition('pending', 'served'), false);
  assert.equal(canTransition('served', 'cancelled'), false);
});

test('order subtotal is calculated from server-side item prices', () => {
  assert.equal(calculateSubtotal([
    { price: 35.5, quantity: 2 },
    { price: 12, quantity: 1 },
  ]), 83);
});

test('order subtotal rejects empty items and invalid quantities', () => {
  assert.throws(() => calculateSubtotal([]), /At least one/);
  assert.throws(() => calculateSubtotal([{ price: 9, quantity: 21 }]), /quantity/);
});
