
import { Outlet, useNavigate } from 'react-router-dom'

import Navbar from './Navbar'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
import ScrollManager from './ScrollManager'

import { useCart } from '../../context/CartContext'

export default function MainLayout() {
  const navigate = useNavigate()
  const { closeCart } = useCart()

  const goToProducts = () => {
    closeCart()
    navigate('/products')
  }

  return (
    <div className="min-h-screen bg-cream text-brand">
      <ScrollManager />

      <Navbar onShopClick={goToProducts} />

      <Outlet />

      <Footer />

      <CartDrawer />
    </div>
  )
}
