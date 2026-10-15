import DashboardLayout from './DashboardLayout';

const DeptHeadLayout = ({ children }) => (
  <DashboardLayout role="depthead" showSidebar>
    {children}
  </DashboardLayout>
);

export default DeptHeadLayout;
