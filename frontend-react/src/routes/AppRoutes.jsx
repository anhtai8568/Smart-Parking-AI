import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import UserLayout from '../layouts/UserLayout';
import ProtectedRoute from '../components/common/ProtectedRoute';

// Import các trang xác thực
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

// Import các trang Admin
import DashboardAdmin from '../pages/admin/DashboardAdmin';
import ManageUsers from '../pages/admin/ManageUsers';
import Pricing from '../pages/admin/Pricing';
import MonthlyRequests from '../pages/admin/MonthlyRequests';
import AdminParkingHistory from '../pages/admin/AdminParkingHistory';

// Import các trang User
import DashboardUser from '../pages/user/DashboardUser';
import ParkingHistory from '../pages/user/ParkingHistory';
import AccountInfo from '../pages/user/AccountInfo';
import PaymentHistory from '../pages/user/PaymentHistory';
import MonthlyTicket from '../pages/user/MonthlyTicket';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardAdmin />} />
          <Route path="monthly-tickets" element={<MonthlyRequests />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="parking-history" element={<AdminParkingHistory />} />
          <Route path="pricing" element={<Pricing />} />
        </Route>

        {/* User Routes */}
        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRole="user">
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardUser />} />

          {/* ĐĂNG KÝ VÉ THÁNG */}
          <Route path="monthly-ticket" element={<MonthlyTicket />} />

          <Route path="history" element={<ParkingHistory />} />
          <Route path="account" element={<AccountInfo />} />
          <Route path="payments" element={<PaymentHistory />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;