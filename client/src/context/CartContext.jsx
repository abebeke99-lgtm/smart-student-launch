import { createContext, useCallback, useContext, useState } from 'react';
import { api, jsonBody } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0 });

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== 'student') {
      setCart({ items: [], total: 0 });
      return;
    }
    const response = await api('/cart');
    setCart(response.data.cart);
  }, [user]);

  const addItem = async (menuItemId, quantity = 1) => {
    const response = await api('/cart/items', {
      method: 'POST',
      body: jsonBody({ menuItemId, quantity }),
    });
    setCart(response.data.cart);
  };

  const updateItem = async (menuItemId, quantity) => {
    const response = await api(`/cart/items/${menuItemId}`, {
      method: 'PUT',
      body: jsonBody({ quantity }),
    });
    setCart(response.data.cart);
  };

  const removeItem = async (menuItemId) => {
    const response = await api(`/cart/items/${menuItemId}`, { method: 'DELETE' });
    setCart(response.data.cart);
  };

  const clear = async () => {
    const response = await api('/cart', { method: 'DELETE' });
    setCart(response.data.cart);
  };

  return (
    <CartContext.Provider value={{ cart, refreshCart, addItem, updateItem, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
