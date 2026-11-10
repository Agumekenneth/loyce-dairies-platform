
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

import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Public pages */}
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

        {/* Customer authentication */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* Email verification */}
        <Route
          path="/verify-email"
          element={<VerifyEmailPage />}
        />

        {/* Password recovery */}
        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        {/* Protected customer account */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/account"
            element={<AccountPage />}
          />
        </Route>

        {/* Undefined routes */}
        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Route>
    </Routes>
  )
}
