
import { Route, Routes } from 'react-router-dom'

import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'

import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailsPage from './pages/ProductDetailsPage'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'

import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

import CheckoutPage from './pages/CheckoutPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Public pages */}
        <Route path="/" element={<HomePage />} />

        <Route
          path="/products"
          element={<ProductsPage />}
        />

        <Route
          path="/products/:id"
          element={<ProductDetailsPage />}
        />

        {/* Authentication */}
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          path="/verify-email"
          element={<VerifyEmailPage />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        {/* Authenticated customer pages */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/account"
            element={<AccountPage />}
          />

          <Route
            path="/checkout"
            element={<CheckoutPage />}
          />
        </Route>

        {/* Unknown routes */}
        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Route>
    </Routes>
  )
}
