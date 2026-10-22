const allowedTransitions = Object.freeze({
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
});

function canTransition(currentStatus, nextStatus) {
  return allowedTransitions[currentStatus]?.includes(nextStatus) || false;
}

function calculateSubtotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one order item is required');
  }
  return items.reduce((sum, item) => {
    if (!Number.isFinite(item.price) || item.price < 0
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error('Order items require a non-negative price and quantity from 1 to 20');
    }
    return sum + item.price * item.quantity;
  }, 0);
}

module.exports = { allowedTransitions, canTransition, calculateSubtotal };
