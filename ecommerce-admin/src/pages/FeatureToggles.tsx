import { useState, useEffect } from 'react'
import {
  FiToggleLeft,
  FiToggleRight,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiAlertTriangle,
  FiZap,
  FiShield,
  FiShoppingCart,
  FiPackage,
  FiMail,
  FiBell,
  FiDollarSign,
  FiUsers,
  FiX,
  FiCheck,
  FiAlertOctagon,
  FiInfo,
  FiClock,
  FiRefreshCw,
} from 'react-icons/fi'
import { featureTogglesAPI } from '../services/api'

interface FeatureToggle {
  id: number
  feature_key: string
  feature_name: string
  description: string | null
  is_enabled: number
  is_kill_switch: number
  category: string
  dependencies: string[] | null
  rollout_percentage: number
  enabled_for_users: number[] | null
  disabled_for_users: number[] | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

interface CategoryInfo {
  category: string
  total: number
  enabled: number
}

export default function FeatureToggles() {
  const [features, setFeatures] = useState<Record<string, FeatureToggle[]>>({})
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState<FeatureToggle | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showKillSwitch, setShowKillSwitch] = useState(false)
  const [killSwitchCategory, setKillSwitchCategory] = useState('')
  const [killSwitchReason, setKillSwitchReason] = useState('')
  const [changeReason, setChangeReason] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    feature_key: '',
    feature_name: '',
    description: '',
    is_enabled: true,
    is_kill_switch: false,
    category: 'general',
    rollout_percentage: 100,
    dependencies: '',
  })

  const categoryIcons: Record<string, any> = {
    auth: FiShield,
    checkout: FiShoppingCart,
    products: FiPackage,
    notifications: FiBell,
    marketing: FiMail,
    payments: FiDollarSign,
    orders: FiShoppingCart,
    inventory: FiPackage,
    support: FiUsers,
    general: FiZap,
  }

  const categoryLabels: Record<string, string> = {
    auth: 'Authentication',
    checkout: 'Checkout',
    products: 'Products',
    notifications: 'Notifications',
    marketing: 'Marketing',
    payments: 'Payments',
    orders: 'Orders',
    inventory: 'Inventory',
    support: 'Support',
    general: 'General',
  }

  useEffect(() => {
    fetchFeatures()
    fetchCategories()
  }, [])

  const fetchFeatures = async () => {
    setLoading(true)
    try {
      const response = await featureTogglesAPI.getAll()
      if (response.data.success) {
        setFeatures(response.data.grouped)
      }
    } catch (error) {
      console.error('Error fetching features:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await featureTogglesAPI.getCategories()
      if (response.data.success) {
        setCategories(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleToggle = async (feature: FeatureToggle) => {
    const action = feature.is_enabled ? 'disable' : 'enable'
    
    if (feature.is_kill_switch && feature.is_enabled) {
      const confirmMsg = `This is a KILL-SWITCH feature! Disabling "${feature.feature_name}" may affect critical functionality. Are you sure?`
      if (!confirm(confirmMsg)) return
    }

    try {
      await featureTogglesAPI.toggle(feature.id, changeReason || undefined)
      setChangeReason('')
      fetchFeatures()
      fetchCategories()
    } catch (error: any) {
      console.error('Error toggling feature:', error)
      alert(error.response?.data?.message || 'Failed to toggle feature')
    }
  }

  const handleKillSwitch = async () => {
    if (!killSwitchCategory) return

    const confirmMsg = `⚠️ EMERGENCY KILL-SWITCH\n\nThis will DISABLE ALL features in the "${killSwitchCategory}" category.\n\nAre you absolutely sure?`
    if (!confirm(confirmMsg)) return

    try {
      await featureTogglesAPI.killSwitch(killSwitchCategory, killSwitchReason)
      setShowKillSwitch(false)
      setKillSwitchCategory('')
      setKillSwitchReason('')
      fetchFeatures()
      fetchCategories()
      alert('Kill-switch activated successfully')
    } catch (error) {
      console.error('Error activating kill-switch:', error)
      alert('Failed to activate kill-switch')
    }
  }

  const handleCreate = async () => {
    if (!formData.feature_key || !formData.feature_name) {
      alert('Feature key and name are required')
      return
    }

    try {
      await featureTogglesAPI.create({
        ...formData,
        dependencies: formData.dependencies ? formData.dependencies.split(',').map(d => d.trim()) : undefined
      })
      setShowModal(false)
      resetForm()
      fetchFeatures()
      fetchCategories()
    } catch (error: any) {
      console.error('Error creating feature:', error)
      alert(error.response?.data?.message || 'Failed to create feature')
    }
  }

  const handleUpdate = async () => {
    if (!selectedFeature) return

    try {
      await featureTogglesAPI.update(selectedFeature.id, {
        feature_name: formData.feature_name,
        description: formData.description,
        category: formData.category,
        is_kill_switch: formData.is_kill_switch,
        rollout_percentage: formData.rollout_percentage,
        dependencies: formData.dependencies ? formData.dependencies.split(',').map(d => d.trim()) : undefined
      })
      setShowModal(false)
      setSelectedFeature(null)
      resetForm()
      fetchFeatures()
    } catch (error) {
      console.error('Error updating feature:', error)
      alert('Failed to update feature')
    }
  }

  const handleDelete = async (feature: FeatureToggle) => {
    if (feature.is_kill_switch) {
      alert('Cannot delete kill-switch features. Disable it instead.')
      return
    }

    if (!confirm(`Delete feature "${feature.feature_name}"?`)) return

    try {
      await featureTogglesAPI.delete(feature.id)
      fetchFeatures()
      fetchCategories()
    } catch (error) {
      console.error('Error deleting feature:', error)
      alert('Failed to delete feature')
    }
  }

  const openEditModal = (feature: FeatureToggle) => {
    setSelectedFeature(feature)
    setFormData({
      feature_key: feature.feature_key,
      feature_name: feature.feature_name,
      description: feature.description || '',
      is_enabled: feature.is_enabled === 1,
      is_kill_switch: feature.is_kill_switch === 1,
      category: feature.category,
      rollout_percentage: feature.rollout_percentage,
      dependencies: feature.dependencies?.join(', ') || '',
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      feature_key: '',
      feature_name: '',
      description: '',
      is_enabled: true,
      is_kill_switch: false,
      category: 'general',
      rollout_percentage: 100,
      dependencies: '',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Feature Toggles</h1>
          <p className="text-gray-600">Enable/disable application features with kill-switch support</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKillSwitch(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100"
          >
            <FiAlertOctagon className="w-4 h-4" />
            Kill-Switch
          </button>
          <button
            onClick={() => { setSelectedFeature(null); resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600"
          >
            <FiPlus className="w-4 h-4" />
            Add Feature
          </button>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat.category] || FiZap
          return (
            <div key={cat.category} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Icon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {categoryLabels[cat.category] || cat.category}
                  </p>
                  <p className="font-semibold">
                    <span className="text-green-600">{cat.enabled}</span>
                    <span className="text-gray-400"> / {cat.total}</span>
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Features List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(features).map(([category, categoryFeatures]) => {
            const Icon = categoryIcons[category] || FiZap

            return (
              <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50 border-b">
                  <Icon className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-800">
                    {categoryLabels[category] || category}
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({categoryFeatures.filter(f => f.is_enabled).length}/{categoryFeatures.length} enabled)
                  </span>
                </div>

                <div className="divide-y">
                  {categoryFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className={`p-4 hover:bg-gray-50 ${
                        !feature.is_enabled ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800">
                              {feature.feature_name}
                            </h4>
                            {feature.is_kill_switch ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                <FiAlertTriangle className="w-3 h-3" />
                                Kill-Switch
                              </span>
                            ) : null}
                            {feature.rollout_percentage < 100 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                {feature.rollout_percentage}% Rollout
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {feature.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                              {feature.feature_key}
                            </span>
                            {feature.dependencies && feature.dependencies.length > 0 && (
                              <span className="flex items-center gap-1">
                                <FiInfo className="w-3 h-3" />
                                Depends on: {feature.dependencies.join(', ')}
                              </span>
                            )}
                            {feature.updated_by_name && (
                              <span className="flex items-center gap-1">
                                <FiClock className="w-3 h-3" />
                                {feature.updated_by_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggle(feature)}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                              feature.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                feature.is_enabled ? 'translate-x-8' : 'translate-x-1'
                              }`}
                            >
                              {feature.is_enabled ? (
                                <FiCheck className="w-3 h-3 text-green-500" />
                              ) : (
                                <FiX className="w-3 h-3 text-gray-400" />
                              )}
                            </span>
                          </button>
                          <button
                            onClick={() => openEditModal(feature)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          {!feature.is_kill_switch && (
                            <button
                              onClick={() => handleDelete(feature)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {Object.keys(features).length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No feature toggles found
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {selectedFeature ? 'Edit Feature Toggle' : 'Create Feature Toggle'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setSelectedFeature(null); }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {!selectedFeature && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feature Key *
                  </label>
                  <input
                    type="text"
                    value={formData.feature_key}
                    onChange={(e) => setFormData({ ...formData, feature_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g., user_registration"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={formData.feature_name}
                  onChange={(e) => setFormData({ ...formData, feature_name: e.target.value })}
                  placeholder="e.g., User Registration"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rollout %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.rollout_percentage}
                    onChange={(e) => setFormData({ ...formData, rollout_percentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependencies (comma-separated feature keys)
                </label>
                <input
                  type="text"
                  value={formData.dependencies}
                  onChange={(e) => setFormData({ ...formData, dependencies: e.target.value })}
                  placeholder="e.g., payment_gateway, user_registration"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Enabled by default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_kill_switch}
                    onChange={(e) => setFormData({ ...formData, is_kill_switch: e.target.checked })}
                    className="w-4 h-4 text-red-500 rounded focus:ring-red-500"
                  />
                  <span className="text-sm text-red-700 flex items-center gap-1">
                    <FiAlertTriangle className="w-3 h-3" />
                    Kill-Switch
                  </span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowModal(false); setSelectedFeature(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={selectedFeature ? handleUpdate : handleCreate}
                className="px-4 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600"
              >
                {selectedFeature ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill-Switch Modal */}
      {showKillSwitch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center gap-3 p-4 border-b bg-red-50">
              <FiAlertOctagon className="w-6 h-6 text-red-600" />
              <h2 className="text-lg font-semibold text-red-800">Emergency Kill-Switch</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This will DISABLE ALL features in the selected category. 
                  Use only in emergency situations.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Category
                </label>
                <select
                  value={killSwitchCategory}
                  onChange={(e) => setKillSwitchCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat.category} value={cat.category}>
                      {categoryLabels[cat.category] || cat.category} ({cat.enabled} enabled)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Kill-Switch *
                </label>
                <textarea
                  value={killSwitchReason}
                  onChange={(e) => setKillSwitchReason(e.target.value)}
                  rows={2}
                  placeholder="Explain why this emergency action is needed..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => { setShowKillSwitch(false); setKillSwitchCategory(''); setKillSwitchReason(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleKillSwitch}
                disabled={!killSwitchCategory || !killSwitchReason}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Activate Kill-Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
