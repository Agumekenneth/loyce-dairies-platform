
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
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
      {/* Shared navigation */}
      <Navbar onShopClick={goToProducts} />

      {/* Active page */}
      <Outlet />

      {/* Shared footer */}
      <Footer />

      {/* Global shopping cart */}
      <CartDrawer />
    </div>
  )
}
