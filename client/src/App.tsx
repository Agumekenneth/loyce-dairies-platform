
import { Route, Routes } from 'react-router-dom'

// ==========================================
// LOYCE DAIRIES PLATFORM
// APPLICATION ROUTING
// ==========================================

// ==========================================
// SHARED APPLICATION LAYOUT
// ==========================================

import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'

// ==========================================
// PUBLIC STOREFRONT
// ==========================================

import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailsPage from './pages/ProductDetailsPage'

// ==========================================
// CUSTOMER AUTHENTICATION
// ==========================================

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

// ==========================================
// CUSTOMER FEATURES
// ==========================================

import AccountPage from './pages/AccountPage'
import CheckoutPage from './pages/CheckoutPage'

// ==========================================
// STAFF ADMINISTRATION
// ==========================================

import StaffOrdersPage from './pages/StaffOrdersPage'
import StaffDeliveryZonesPage from './pages/StaffDeliveryZonesPage'

// ==========================================
// STAFF INVENTORY MANAGEMENT
// MILESTONE 4.7.3
// ==========================================

import StaffInventoryPage from './pages/StaffInventoryPage'

// ==========================================
// FALLBACK PAGE
// ==========================================

import NotFoundPage from './pages/NotFoundPage'

// ==========================================
// APPLICATION ROUTES
// ==========================================

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>

        {/* ==================================
            PUBLIC STOREFRONT
        ================================== */}

        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/products"
          element={<ProductsPage />}
        />

        <Route
          path="/products/:id"
          element={<ProductDetailsPage />}
        />

        {/* ==================================
            CUSTOMER AUTHENTICATION
        ================================== */}

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* ==================================
            EMAIL VERIFICATION
        ================================== */}

        <Route
          path="/verify-email"
          element={<VerifyEmailPage />}
        />

        {/* ==================================
            PASSWORD RECOVERY
        ================================== */}

        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        {/* ==================================
            AUTHENTICATED PAGES
        ================================== */}

        <Route element={<ProtectedRoute />}>

          {/* Customer account */}

          <Route
            path="/account"
            element={<AccountPage />}
          />

          {/* Customer checkout */}

          <Route
            path="/checkout"
            element={<CheckoutPage />}
          />

          {/* ==================================
              STAFF ORDER MANAGEMENT
          ================================== */}

          <Route
            path="/staff/orders"
            element={<StaffOrdersPage />}
          />

          {/* ==================================
              STAFF DELIVERY-ZONE MANAGEMENT
          ================================== */}

          <Route
            path="/staff/delivery-zones"
            element={<StaffDeliveryZonesPage />}
          />

          {/* ==================================
              STAFF INVENTORY MANAGEMENT
              MILESTONE 4.7.3
          ================================== */}

          <Route
            path="/staff/inventory"
            element={<StaffInventoryPage />}
          />

        </Route>

        {/* ==================================
            UNRECOGNIZED ROUTES
        ================================== */}

        <Route
          path="*"
          element={<NotFoundPage />}
        />

      </Route>
    </Routes>
  )
}
