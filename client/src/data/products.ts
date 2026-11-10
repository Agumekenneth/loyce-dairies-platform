
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
    description:
      'Enjoy the creamy taste of whole milk as part of your everyday routine. A versatile dairy favourite for tea, breakfast, cooking and more.',
    highlights: [
      'Great for tea and breakfast',
      'Versatile for everyday cooking',
      'Convenient 1-litre size',
    ],
  },
  {
    id: 2,
    name: 'Creamy Natural Yoghurt',
    category: 'Yoghurt',
    price: 5000,
    unit: '500 ml',
    image:
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&auto=format&fit=crop&q=85',
    description:
      'A creamy natural yoghurt option for breakfast, snacks or enjoying on its own. A simple addition to your daily dairy favourites.',
    highlights: [
      'Creamy texture',
      'Enjoy on its own or with breakfast',
      'Convenient 500 ml size',
    ],
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
    description:
      'A rich butter option for spreading, baking and preparing your favourite meals. An everyday kitchen essential.',
    highlights: [
      'Suitable for spreading',
      'Useful for baking and cooking',
      'Convenient 250 g size',
    ],
  },
  {
    id: 4,
    name: 'Traditional Pure Ghee',
    category: 'Ghee',
    price: 18000,
    unit: '500 ml',
    image:
      'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&auto=format&fit=crop&q=85',
    description:
      'Traditional ghee for adding rich dairy flavour to your favourite dishes. A versatile ingredient for home cooking.',
    highlights: [
      'Traditional dairy favourite',
      'Suitable for everyday cooking',
      'Convenient 500 ml size',
    ],
  },
]

export const categories: string[] = [
  'All products',
  'Fresh Milk',
  'Yoghurt',
  'Butter',
  'Ghee',
]

export const formatPrice = (price: number): string =>
  `UGX ${new Intl.NumberFormat('en-UG').format(price)}`
