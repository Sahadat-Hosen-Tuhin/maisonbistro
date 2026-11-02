import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Home from './pages/Home'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage'
import AdminResourcePage from './pages/admin/AdminResourcePage'
import AdminStaffPage from './pages/admin/AdminStaffPage'
import MenuManagementPage from './pages/admin/MenuManagementPage'
import AdminInventoryPage from './pages/admin/AdminInventoryPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminFloorPage from './pages/admin/AdminFloorPage'
import Categories from './pages/Categories'
import About from './pages/About'
import Contact from './pages/Contact'
import WaiterLogin from './pages/waiter/WaiterLogin'
import WaiterDashboard from './pages/waiter/WaiterDashboard'
import StaffLogin from './pages/staff/StaffLogin'
import KitchenDashboard from './pages/staff/KitchenDashboard'
import CashierDashboard from './pages/staff/CashierDashboard'
import DeliveryDashboard from './pages/staff/DeliveryDashboard'
import ManagerDashboard from './pages/staff/ManagerDashboard'
import CustomerLogin from './pages/customer/CustomerLogin'
import CustomerRegister from './pages/customer/CustomerRegister'
import CustomerDashboard from './pages/customer/CustomerDashboard'
import ReservationManagementPage from './pages/ReservationManagementPage'
import CategoryDetail from './pages/CategoryDetail'
import MenuDetail from './pages/MenuDetail'

function AdminGuard({ children }) {
  return localStorage.getItem('maison_admin_token') ? children : <Navigate to="/admin/login" replace />
}

function WaiterGuard({ children }) {
  return localStorage.getItem('maison_waiter_token') ? children : <Navigate to="/waiter/login" replace />
}

function StaffGuard({ role, children }) {
  return localStorage.getItem(`maison_${role}_token`) ? children : <Navigate to={`/${role}/login`} replace />
}
function CustomerGuard({ children }) {
  return localStorage.getItem('maison_customer_token') ? children : <Navigate to="/customer/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Home menuOnly />} />
        <Route path="/categories/:slug" element={<CategoryDetail />} />
        <Route path="/menu/:slug" element={<MenuDetail />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/waiter/login" element={<WaiterLogin />} />
        <Route path="/waiter" element={<WaiterGuard><WaiterDashboard /></WaiterGuard>} />
        <Route path="/kitchen/login" element={<StaffLogin role="kitchen" />} />
        <Route path="/kitchen" element={<StaffGuard role="kitchen"><KitchenDashboard /></StaffGuard>} />
        <Route path="/cashier/login" element={<StaffLogin role="cashier" />} />
        <Route path="/cashier" element={<StaffGuard role="cashier"><CashierDashboard /></StaffGuard>} />
        <Route path="/cashier/reservations" element={<StaffGuard role="cashier"><ReservationManagementPage role="cashier" /></StaffGuard>} />
        <Route path="/delivery/login" element={<StaffLogin role="delivery" />} />
        <Route path="/delivery" element={<StaffGuard role="delivery"><DeliveryDashboard /></StaffGuard>} />
        <Route path="/manager/login" element={<StaffLogin role="manager" />} />
        <Route path="/manager" element={<StaffGuard role="manager"><ManagerDashboard /></StaffGuard>} />
        <Route path="/manager/reservations" element={<StaffGuard role="manager"><ReservationManagementPage role="manager" /></StaffGuard>} />
        <Route path="/manager/inventory" element={<StaffGuard role="manager"><AdminInventoryPage /></StaffGuard>} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/register" element={<CustomerRegister />} />
        <Route path="/customer" element={<CustomerGuard><CustomerDashboard /></CustomerGuard>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="staff" element={<AdminStaffPage />} />
          <Route path="menu" element={<MenuManagementPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="floors" element={<AdminFloorPage />} />
          <Route path="reservations" element={<ReservationManagementPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path=":resource" element={<AdminResourcePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
