import { createContext } from 'react';

export const DashboardSidebarContext = createContext({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});
