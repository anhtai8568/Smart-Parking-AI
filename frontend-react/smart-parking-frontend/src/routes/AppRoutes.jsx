import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'
import UserLayout from '../layouts/UserLayout'
import ProtectedRoute from '../components/common/ProtectedRoute'

import Login from '../pages/Login'
import DashboardAdmin from '../pages/admin/DashboardAdmin'
import ManageUsers from '../pages/admin/ManageUsers'
import ManageVehicles from '../pages/admin/ManageVehicles'
import VisitorParking from '../pages/admin/VisitorParking'
import Pricing from '../pages/admin/Pricing'
import Reports from '../pages/admin/Reports'
import Settings from '../pages/admin/Settings'

import DashboardUser from '../pages/user/DashboardUser'
import ParkingHistory from '../pages/user/ParkingHistory'
import AccountInfo from '../pages/user/AccountInfo'
import PaymentHistory from '../pages/user/PaymentHistory'
import Topup from '../pages/user/Topup'

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardAdmin />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="vehicles" element={<ManageVehicles />} />
          <Route path="visitors" element={<VisitorParking />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRole="user">
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardUser />} />
          <Route path="history" element={<ParkingHistory />} />
          <Route path="account" element={<AccountInfo />} />
          <Route path="payments" element={<PaymentHistory />} />
          <Route path="topup" element={<Topup />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes