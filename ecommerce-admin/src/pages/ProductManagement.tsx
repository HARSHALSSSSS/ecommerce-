import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Package,
  X,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  TrendingDown,
  Box,
  History,
  Filter,
  Download,
  BarChart3,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { productManagementAPI, categoriesAPI, inventoryAPI } from '../services/api'

interface Product {
  id: number
  name: string
  description: string
  price: number
  discount_percent: number
  category: string
  category_id: number | null
  category_name: string | null
  store_id: number | null
  store_name: string | null
  rating: number
  image_url: string
  stock_quantity: number
  sku: string
  is_active: number
  is_visible: number
  low_stock_threshold: number
  reorder_quantity: number
  version: number
  stock_status: string
  last_stock_update: string | null
  created_at: string
  updated_at: string
}

interface ProductStats {
  totalProducts: number
  activeVisible: number
  activeHidden: number
  inactive: number
  outOfStock: number
  lowStock: number
  totalInventory: number
  avgPrice: number
  unresolvedAlerts: number
}

interface Category {
  id: number
  name: string
  slug: string
  is_active: number
}

interface ProductVersion {
  id: number
  product_id: number
  version: number
  changes: string
  changed_by_name: string
  created_at: string
}

interface InventoryLog {
  id: number
  product_id: number
  previous_quantity: number
  new_quantity: number
  change_quantity: number
  change_type: string
  reason: string
  changed_by_name: string
  created_at: string
}

type TabType = 'products' | 'inventory'

export default function Products() {
  const [activeTab, setActiveTab] = useState<TabType>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('DESC')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  
  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productVersions, setProductVersions] = useState<ProductVersion[]>([])
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([])
  const [saving, setSaving] = useState(false)
  
  // Bulk operations
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discount_percent: 0,
    category_id: null as number | null,
    category: '',
    image_url: '',
    store_id: null as number | null,
    stock_quantity: 0,
    sku: '',
    is_active: 1,
    is_visible: 1,
    low_stock_threshold: 10,
    reorder_quantity: 50,
  })

  useEffect(() => {
    loadProducts()
    loadStats()
    loadCategories()
  }, [page, search, categoryFilter, statusFilter, stockFilter, sortBy, sortOrder])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await productManagementAPI.getAll({
        page,
        limit: 15,
        search,
        category: categoryFilter,
        status: statusFilter,
        stockStatus: stockFilter,
        sortBy,
        sortOrder,
      })
      setProducts(response.data.products)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await productManagementAPI.getStats()
      setStats(response.data.stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.getAll({ status: 'active', limit: 100 })
      setCategories(response.data.categories)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadProductDetail = async (product: Product) => {
    try {
      const response = await productManagementAPI.getById(product.id)
      setSelectedProduct(response.data.product)
      setProductVersions(response.data.versions || [])
      setInventoryLogs(response.data.inventoryLogs || [])
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading product detail:', error)
      toast.error('Failed to load product details')
    }
  }

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        discount_percent: product.discount_percent,
        category_id: product.category_id,
        category: product.category || '',
        image_url: product.image_url || '',
        store_id: product.store_id,
        stock_quantity: product.stock_quantity,
        sku: product.sku || '',
        is_active: product.is_active,
        is_visible: product.is_visible,
        low_stock_threshold: product.low_stock_threshold,
        reorder_quantity: product.reorder_quantity,
      })
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        description: '',
        price: 0,
        discount_percent: 0,
        category_id: null,
        category: '',
        image_url: '',
        store_id: null,
        stock_quantity: 0,
        sku: '',
        is_active: 1,
        is_visible: 1,
        low_stock_threshold: 10,
        reorder_quantity: 50,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.price) {
      toast.error('Name and price are required')
      return
    }

    setSaving(true)
    try {
      if (editingProduct) {
        await productManagementAPI.update(editingProduct.id, formData)
        toast.success('Product updated successfully')
      } else {
        await productManagementAPI.create(formData)
        toast.success('Product created successfully')
      }
      handleCloseModal()
      loadProducts()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleVisibility = async (product: Product) => {
    try {
      await productManagementAPI.toggleVisibility(product.id)
      toast.success(`Product ${product.is_visible ? 'hidden' : 'shown'} successfully`)
      loadProducts()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to toggle visibility')
    }
  }

  const handleBulkVisibility = async (action: 'show' | 'hide') => {
    if (selectedIds.length === 0) {
      toast.error('No products selected')
      return
    }

    try {
      const response = await productManagementAPI.bulkVisibility(selectedIds, action)
      toast.success(`Bulk ${action} completed: ${response.data.results.success} updated`)
      setSelectedIds([])
      setShowBulkModal(false)
      loadProducts()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process bulk action')
    }
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>, action: 'show' | 'hide') => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const response = await productManagementAPI.bulkVisibilityCSV(file, action)
      toast.success(`CSV processed: ${response.data.results.success} updated, ${response.data.results.skipped} skipped`)
      loadProducts()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process CSV')
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const toggleSelectProduct = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(products.map(p => p.id))
    }
  }

  const getStockBadge = (product: Product) => {
    if (product.stock_quantity === 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Out of Stock</span>
    } else if (product.stock_quantity <= product.low_stock_threshold) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Low Stock</span>
    }
    return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">In Stock</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products & Inventory</h1>
          <p className="text-gray-600 mt-1">Manage products, visibility, and stock levels</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Bulk Actions
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Products</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Visible</p>
                <p className="text-xl font-bold text-gray-900">{stats.activeVisible}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <EyeOff className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Hidden</p>
                <p className="text-xl font-bold text-gray-900">{stats.activeHidden}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Out of Stock</p>
                <p className="text-xl font-bold text-gray-900">{stats.outOfStock}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Low Stock</p>
                <p className="text-xl font-bold text-gray-900">{stats.lowStock}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Status</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-orange-800 font-medium">{selectedIds.length} products selected</span>
          <div className="flex gap-3">
            <button
              onClick={() => handleBulkVisibility('show')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Eye className="w-4 h-4" />
              Show All
            </button>
            <button
              onClick={() => handleBulkVisibility('hide')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              <EyeOff className="w-4 h-4" />
              Hide All
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-100"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="py-4 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === products.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Product</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">SKU</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Category</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Price</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Stock</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-600">Visibility</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 max-w-[200px] truncate">{product.name}</p>
                          <p className="text-sm text-gray-500">ID: {product.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{product.sku || '-'}</code>
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm">{product.category_name || product.category || '-'}</td>
                    <td className="py-4 px-4">
                      <div>
                        <span className="font-medium text-gray-900">${product.price.toFixed(2)}</span>
                        {product.discount_percent > 0 && (
                          <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            -{product.discount_percent}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-gray-900">{product.stock_quantity}</span>
                        {getStockBadge(product)}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleVisibility(product)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          product.is_visible
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {product.is_visible ? (
                          <>
                            <Eye className="w-4 h-4" />
                            Visible
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Hidden
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => loadProductDetail(product)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <BarChart3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} products
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => {
                      const catId = e.target.value ? parseInt(e.target.value) : null
                      const cat = categories.find(c => c.id === catId)
                      setFormData({ ...formData, category_id: catId, category: cat?.slug || '' })
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={3}
                    placeholder="Enter product description"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_visible === 1}
                      onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked ? 1 : 0 })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Visible in store</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active === 1}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Product Info */}
              <div className="flex gap-6 mb-6">
                {selectedProduct.image_url && (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h3>
                  <p className="text-gray-500 mt-1">SKU: {selectedProduct.sku}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-2xl font-bold text-orange-500">${selectedProduct.price.toFixed(2)}</span>
                    {getStockBadge(selectedProduct)}
                    <span className={`px-2 py-1 rounded text-xs ${selectedProduct.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedProduct.is_visible ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Version: {selectedProduct.version}</p>
                </div>
              </div>

              {/* Version History */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Version History
                </h4>
                {productVersions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No version history</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {productVersions.map((v) => (
                      <div key={v.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Version {v.version}</span>
                          <span className="text-gray-500">{format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                        <p className="text-gray-600 mt-1">By: {v.changed_by_name || 'System'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inventory Logs */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  Stock History
                </h4>
                {inventoryLogs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No stock changes recorded</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {inventoryLogs.map((log) => (
                      <div key={log.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${log.change_quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.change_quantity >= 0 ? '+' : ''}{log.change_quantity} units
                          </span>
                          <span className="text-gray-500">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                        <p className="text-gray-600">{log.previous_quantity} → {log.new_quantity}</p>
                        <p className="text-gray-500 text-xs mt-1">{log.reason || log.change_type}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Bulk Actions</h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Upload CSV</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Upload a CSV file with product IDs or SKUs to bulk show/hide products.
                </p>
                <div className="flex gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={(e) => handleCSVUpload(e, 'show')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.onchange = (e) => handleCSVUpload(e as any, 'show')
                          fileInputRef.current.click()
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Upload className="w-4 h-4" />
                      CSV → Show
                    </button>
                  </label>
                  <label className="flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.onchange = (e) => handleCSVUpload(e as any, 'hide')
                          fileInputRef.current.click()
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      <Upload className="w-4 h-4" />
                      CSV → Hide
                    </button>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-2">CSV Format</h3>
                <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
                  product_id<br />
                  1<br />
                  2<br />
                  SKU-001
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Each row should contain a product ID or SKU. Header row is optional.
                </p>
              </div>

              <button
                onClick={() => {
                  // Download sample CSV
                  const csv = 'product_id\n1\n2\n3'
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'sample_products.csv'
                  a.click()
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Download Sample CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
