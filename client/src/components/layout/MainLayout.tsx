
import {
  Outlet,
  useNavigate,
} from 'react-router-dom'

import Navbar from './Navbar'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
import ScrollManager from './ScrollManager'

import StaffNotificationCenter from '../staff/StaffNotificationCenter'

import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'

// ==========================================
// LOYCE DAIRIES PLATFORM
// SHARED APPLICATION LAYOUT
//
// MILESTONE 4.13
// PERSISTENT STAFF ORDER NOTIFICATIONS
// ==========================================

export default function MainLayout() {
  const navigate = useNavigate()

  const { closeCart } = useCart()

  const {
    customer,
    isAuthenticated,
  } = useAuth()

  // ========================================
  // STAFF ACCESS VERIFICATION
  // ========================================

  // Only authenticated and verified
  // staff members may access the global
  // notification interface.
  //
  // The backend independently validates
  // staff permissions on every request.

  const isStaff =
    isAuthenticated &&
    customer !== null &&
    customer.role === 'STAFF' &&
    customer.emailVerifiedAt !== null

  // ========================================
  // STOREFRONT NAVIGATION
  // ========================================

  const goToProducts = () => {
    closeCart()

    navigate('/products')
  }

  // ========================================
  // SHARED APPLICATION LAYOUT
  // ========================================

  return (
    <div className="min-h-screen bg-cream text-brand">

      {/* ====================================
          SCROLL MANAGEMENT
      ==================================== */}

      <ScrollManager />

      {/* ====================================
          MAIN NAVIGATION
      ==================================== */}

      <Navbar
        onShopClick={goToProducts}
      />

      {/* ====================================
          ACTIVE APPLICATION PAGE
      ==================================== */}

      <Outlet />

      {/* ====================================
          SITE FOOTER
      ==================================== */}

      <Footer />

      {/* ====================================
          CUSTOMER SHOPPING CART
      ==================================== */}

      <CartDrawer />

      {/* ====================================
          MILESTONE 4.13
          GLOBAL STAFF NOTIFICATIONS
      ==================================== */}

      {/*
        This component remains mounted
        throughout normal route navigation.

        It provides:
        - Floating notification bell
        - Unread notification counter
        - Periodic new-order monitoring
        - Audible alerts when enabled
        - Notification history
        - Individual staff read receipts

        Only one notification monitor is
        active per mounted application
        layout and authenticated staff session.

        The component unmounts automatically
        when the user is no longer an
        authenticated, verified staff member.
      */}

      {isStaff && (
        <StaffNotificationCenter
          mode="floating"
        />
      )}

    </div>
  )
}
