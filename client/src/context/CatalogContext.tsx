
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { Product } from '../types/product'

import {
  fetchProducts,
  fetchCategories,
} from '../services/catalogApi'

type CatalogStatus = 'loading' | 'ready' | 'error'

type CatalogContextValue = {
  products: Product[]
  categories: string[]
  status: CatalogStatus
  loading: boolean
  error: string | null
  reloadCatalog: () => void
  getProductById: (id: number) => Product | undefined
}

const CatalogContext = createContext<
  CatalogContextValue | undefined
>(undefined)

export function CatalogProvider({
  children,
}: {
  children: ReactNode
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([
    'All products',
  ])

  const [status, setStatus] =
    useState<CatalogStatus>('loading')

  const [error, setError] = useState<string | null>(null)

  const [reloadVersion, setReloadVersion] = useState(0)

  // Load the product catalogue from the backend API
  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setStatus('loading')
      setError(null)

      try {
        const [loadedProducts, loadedCategories] =
          await Promise.all([
            fetchProducts(),
            fetchCategories(),
          ])

        // Ignore responses from obsolete requests
        if (!active) return

        setProducts(loadedProducts)
        setCategories(loadedCategories)
        setStatus('ready')
      } catch (caughtError: unknown) {
        if (!active) return

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to load the product catalogue.'

        setError(message)
        setStatus('error')
      }
    }

    void loadCatalog()

    return () => {
      active = false
    }
  }, [reloadVersion])

  // Allow components to retry failed requests
  const reloadCatalog = useCallback(() => {
    setReloadVersion((current) => current + 1)
  }, [])

  // Retrieve a product from the shared catalogue
  const getProductById = useCallback(
    (id: number): Product | undefined => {
      return products.find((product) => product.id === id)
    },
    [products],
  )

  const value = useMemo<CatalogContextValue>(
    () => ({
      products,
      categories,
      status,
      loading: status === 'loading',
      error,
      reloadCatalog,
      getProductById,
    }),
    [
      products,
      categories,
      status,
      error,
      reloadCatalog,
      getProductById,
    ],
  )

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  )
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext)

  if (context === undefined) {
    throw new Error(
      'useCatalog must be used within a CatalogProvider',
    )
  }

  return context
}
