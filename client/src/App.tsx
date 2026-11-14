
import {
  Route,
  Routes,
} from 'react-router-dom'

// ==========================================
// LOYCE DAIRIES PLATFORM
// APPLICATION ROUTING
//
// MILESTONE 4.16
// UNATTENDED ORDER MONITORING INTEGRATION
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
// STAFF ORDER MANAGEMENT
// ==========================================

import StaffOrdersPage from './pages/StaffOrdersPage'

// ==========================================
// MILESTONE 4.16
// UNATTENDED ORDER MONITORING
// ==========================================

import StaffOrderAttentionPanel from './components/staff/StaffOrderAttentionPanel'
import StaffPushQueueHealthPanel from './components/staff/StaffPushQueueHealthPanel'

// ==========================================
// STAFF DELIVERY-ZONE MANAGEMENT
// ==========================================

import StaffDeliveryZonesPage from './pages/StaffDeliveryZonesPage'

// ==========================================
// STAFF INVENTORY MANAGEMENT
// ==========================================

import StaffInventoryPage from './pages/StaffInventoryPage'

// ==========================================
// STAFF PRODUCT MANAGEMENT
// ==========================================

import StaffProductsPage from './pages/StaffProductsPage'

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

          {/* CUSTOMER ACCOUNT */}

          <Route
            path="/account"
            element={<AccountPage />}
          />

          {/* CUSTOMER CHECKOUT */}

          <Route
            path="/checkout"
            element={<CheckoutPage />}
          />

          {/* ==================================
              MILESTONE 4.16
              STAFF ORDER MANAGEMENT
              AND UNATTENDED ORDER MONITORING
          ================================== */}

          <Route
            path="/staff/orders"
            element={
              <>
                {/* Unattended-order dashboard */}

                <section
                  aria-label="Staff order monitoring"
                  className="bg-cream px-5 pt-8 lg:px-8"
                >
                  <div className="mx-auto max-w-7xl">
                    <StaffOrderAttentionPanel />

                    {/* Firebase notification
                        delivery monitoring */}

                    <div className="mt-6">
                      <StaffPushQueueHealthPanel />
                    </div>
                  </div>
                </section>

                {/* Existing order-management
                    functionality is unchanged. */}

                <StaffOrdersPage />
              </>
            }
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
          ================================== */}

          <Route
            path="/staff/inventory"
            element={<StaffInventoryPage />}
          />

          {/* ==================================
              STAFF PRODUCT MANAGEMENT
          ================================== */}

          <Route
            path="/staff/products"
            element={<StaffProductsPage />}
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
