
import { Route, Routes } from 'react-router-dom'

import MainLayout from './components/layout/MainLayout'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailsPage from './pages/ProductDetailsPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route
          path="/products/:id"
          element={<ProductDetailsPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
