import type { Product } from '../types/product'

export const products: Product[] = [
  {
    id: 1,
    name: 'Fresh Whole Milk',
    category: 'Fresh Milk',
    price: 3500,
    unit: '1 litre',
    image:
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop&q=85',
    badge: 'Popular',
  },
  {
    id: 2,
    name: 'Creamy Natural Yoghurt',
    category: 'Yoghurt',
    price: 5000,
    unit: '500 ml',
    image:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&auto=format&fit=crop&q=85',
  },
  {
    id: 3,
    name: 'Farmhouse Butter',
    category: 'Butter',
    price: 12000,
    unit: '250 g',
    image:
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&auto=format&fit=crop&q=85',
    badge: 'Farm favourite',
  },
  {
    id: 4,
    name: 'Traditional Pure Ghee',
    category: 'Ghee',
    price: 18000,
    unit: '500 ml',
    image:
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&auto=format&fit=crop&q=85',
  },
]

export const categories: string[] = [
  'All products',
  'Fresh Milk',
  'Yoghurt',
  'Butter',
  'Ghee',
]

export const formatPrice = (price: number): string => {
  return `UGX ${new Intl.NumberFormat('en-UG').format(price)}`
}
