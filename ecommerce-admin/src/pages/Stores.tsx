import { useState } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Store as StoreIcon,
  X,
  Upload,
  MapPin,
  Star,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Store {
  id: number
  name: string
  location: string
  rating: number
  followers: number
  order_processed: string
  image_url: string
  description: string
  is_active: boolean
}

// Mock data
const mockStores: Store[] = [
  { id: 1, name: 'TechHub Store', location: 'New York, USA', rating: 4.8, followers: 12500, order_processed: '2 Hours', image_url: '', description: 'Your one-stop shop for all tech gadgets and accessories.', is_active: true },
  { id: 2, name: 'Fashion Forward', location: 'Los Angeles, USA', rating: 4.6, followers: 8900, order_processed: '4 Hours', image_url: '', description: 'Trendy fashion for the modern lifestyle.', is_active: true },
  { id: 3, name: 'Home Essentials', location: 'Chicago, USA', rating: 4.5, followers: 6700, order_processed: '3 Hours', image_url: '', description: 'Everything you need for your home.', is_active: false },
  { id: 4, name: 'Sports Zone', location: 'Houston, USA', rating: 4.7, followers: 10200, order_processed: '1 Hour', image_url: '', description: 'Premium sports equipment and apparel.', is_active: true },
]

export default function Stores() {
  const [stores, setStores] = useState<Store[]>(mockStores)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  const filteredStores = stores.filter((store) =>
    store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.location.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddStore = () => {
    setEditingStore(null)
    setShowModal(true)
  }

  const handleEditStore = (store: Store) => {
    setEditingStore(store)
    setShowModal(true)
  }

  const handleDeleteStore = (id: number) => {
    setStores(stores.filter((s) => s.id !== id))
    setShowDeleteConfirm(null)
    toast.success('Store deleted successfully')
  }

  const handleSaveStore = (storeData: Partial<Store>) => {
    if (editingStore) {
      setStores(stores.map((s) => (s.id === editingStore.id ? { ...s, ...storeData } : s)))
      toast.success('Store updated successfully')
    } else {
      const newStore: Store = {
        id: Math.max(...stores.map((s) => s.id)) + 1,
        name: storeData.name || '',
        location: storeData.location || '',
        rating: 0,
        followers: 0,
        order_processed: storeData.order_processed || '2 Hours',
        image_url: storeData.image_url || '',
        description: storeData.description || '',
        is_active: true,
      }
      setStores([...stores, newStore])
      toast.success('Store created successfully')
    }
    setShowModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stores</h1>
          <p className="text-gray-500">Manage your store locations</p>
        </div>
        <button
          onClick={handleAddStore}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Store
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <div key={store.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Store Image */}
            <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              {store.image_url ? (
                <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <StoreIcon className="w-16 h-16 text-primary/40" />
              )}
            </div>

            {/* Store Info */}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{store.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin className="w-4 h-4" />
                    {store.location}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  store.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {store.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{store.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {store.rating}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-gray-400" />
                  {store.followers.toLocaleString()} followers
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditStore(store)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(store.id)}
                  className="px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredStores.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <StoreIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No stores found</p>
        </div>
      )}

      {/* Store Modal */}
      {showModal && (
        <StoreModal
          store={editingStore}
          onClose={() => setShowModal(false)}
          onSave={handleSaveStore}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Store</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this store? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStore(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StoreModal({
  store,
  onClose,
  onSave,
}: {
  store: Store | null
  onClose: () => void
  onSave: (data: Partial<Store>) => void
}) {
  const [formData, setFormData] = useState({
    name: store?.name || '',
    location: store?.location || '',
    order_processed: store?.order_processed || '2 Hours',
    description: store?.description || '',
    image_url: store?.image_url || '',
    is_active: store?.is_active ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            {store ? 'Edit Store' : 'Add New Store'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Image</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Order Processing Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Order Processing Time</label>
            <select
              value={formData.order_processed}
              onChange={(e) => setFormData({ ...formData, order_processed: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="1 Hour">1 Hour</option>
              <option value="2 Hours">2 Hours</option>
              <option value="4 Hours">4 Hours</option>
              <option value="1 Day">1 Day</option>
              <option value="2-3 Days">2-3 Days</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Store is active</label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              {store ? 'Update Store' : 'Create Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
