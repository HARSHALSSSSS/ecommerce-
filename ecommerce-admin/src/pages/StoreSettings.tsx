import { useState, useEffect } from 'react'
import {
  FiSave,
  FiRefreshCw,
  FiClock,
  FiSettings,
  FiShield,
  FiShoppingCart,
  FiTruck,
  FiPercent,
  FiHome,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiRotateCcw,
} from 'react-icons/fi'
import { settingsAPI } from '../services/api'

interface Setting {
  id: number
  setting_key: string
  setting_value: string
  setting_type: 'string' | 'number' | 'boolean'
  category: string
  description: string
  is_sensitive: number
  version: number
  updated_by_name: string | null
  updated_at: string
}

interface SettingHistory {
  id: number
  setting_key: string
  old_value: string
  new_value: string
  version: number
  changed_by_name: string
  change_reason: string
  created_at: string
}

export default function StoreSettings() {
  const [settings, setSettings] = useState<Record<string, Setting[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedSettings, setEditedSettings] = useState<Record<number, any>>({})
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState<number | null>(null)
  const [history, setHistory] = useState<SettingHistory[]>([])
  const [changeReason, setChangeReason] = useState('')

  const categoryIcons: Record<string, any> = {
    store: FiHome,
    tax: FiPercent,
    shipping: FiTruck,
    orders: FiShoppingCart,
    cart: FiShoppingCart,
    security: FiShield,
    system: FiSettings,
    general: FiSettings,
  }

  const categoryLabels: Record<string, string> = {
    store: 'Store Information',
    tax: 'Tax Configuration',
    shipping: 'Shipping Settings',
    orders: 'Order Settings',
    cart: 'Cart Settings',
    security: 'Security Settings',
    system: 'System Settings',
    general: 'General Settings',
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await settingsAPI.getAll()
      if (response.data.success) {
        setSettings(response.data.grouped)
        // Expand first category by default
        const categories = Object.keys(response.data.grouped)
        if (categories.length > 0) {
          setExpandedCategories([categories[0]])
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (settingId: number) => {
    try {
      const response = await settingsAPI.getHistory(settingId)
      if (response.data.success) {
        setHistory(response.data.data)
        setShowHistory(settingId)
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleSettingChange = (setting: Setting, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      [setting.id]: { ...setting, newValue: value }
    }))
  }

  const hasChanges = Object.keys(editedSettings).length > 0

  const handleSave = async () => {
    if (!hasChanges) return

    setSaving(true)
    try {
      const settingsToUpdate = Object.values(editedSettings).map((s: any) => ({
        key: s.setting_key,
        value: s.newValue
      }))

      await settingsAPI.bulkUpdate({
        settings: settingsToUpdate,
        change_reason: changeReason || 'Settings updated'
      })

      setEditedSettings({})
      setChangeReason('')
      fetchSettings()
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRollback = async (settingId: number, version: number) => {
    if (!confirm('Are you sure you want to rollback to this version?')) return

    try {
      await settingsAPI.rollback(settingId, version)
      setShowHistory(null)
      fetchSettings()
      alert('Setting rolled back successfully!')
    } catch (error) {
      console.error('Error rolling back:', error)
      alert('Failed to rollback setting')
    }
  }

  const discardChanges = () => {
    setEditedSettings({})
    setChangeReason('')
  }

  const getSettingValue = (setting: Setting) => {
    if (editedSettings[setting.id]) {
      return editedSettings[setting.id].newValue
    }
    return setting.setting_value
  }

  const renderSettingInput = (setting: Setting) => {
    const value = getSettingValue(setting)
    const isEdited = editedSettings[setting.id] !== undefined

    if (setting.setting_type === 'boolean') {
      const boolValue = value === 'true' || value === true
      return (
        <button
          onClick={() => handleSettingChange(setting, !boolValue)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            boolValue ? 'bg-orange-500' : 'bg-gray-300'
          } ${isEdited ? 'ring-2 ring-orange-300' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              boolValue ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      )
    }

    if (setting.setting_type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleSettingChange(setting, e.target.value)}
          className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
            isEdited ? 'border-orange-500 bg-orange-50' : ''
          }`}
        />
      )
    }

    // String type
    if (setting.is_sensitive) {
      return (
        <input
          type="password"
          value={value}
          onChange={(e) => handleSettingChange(setting, e.target.value)}
          className={`w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
            isEdited ? 'border-orange-500 bg-orange-50' : ''
          }`}
        />
      )
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleSettingChange(setting, e.target.value)}
        className={`w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
          isEdited ? 'border-orange-500 bg-orange-50' : ''
        }`}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Store Settings</h1>
          <p className="text-gray-600">Configure your store settings (version-controlled)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white rounded-lg border hover:bg-gray-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {hasChanges && (
            <>
              <button
                onClick={discardChanges}
                className="flex items-center gap-2 px-4 py-2 text-red-600 bg-white rounded-lg border border-red-300 hover:bg-red-50"
              >
                <FiX className="w-4 h-4" />
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pending Changes Banner */}
      {hasChanges && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-orange-800">
                You have {Object.keys(editedSettings).length} unsaved change(s)
              </h3>
              <p className="text-sm text-orange-600 mt-1">
                Changes will be saved with version history for rollback capability.
              </p>
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Change reason (optional)"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(settings).map(([category, categorySettings]) => {
            const Icon = categoryIcons[category] || FiSettings
            const isExpanded = expandedCategories.includes(category)

            return (
              <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Icon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-800">
                        {categoryLabels[category] || category}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {categorySettings.length} setting(s)
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <FiChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t divide-y">
                    {categorySettings.map((setting) => (
                      <div key={setting.id} className="p-4 hover:bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <label className="font-medium text-gray-800">
                                {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </label>
                              {editedSettings[setting.id] && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                  Modified
                                </span>
                              )}
                            </div>
                            {setting.description && (
                              <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <FiClock className="w-3 h-3" />
                                v{setting.version}
                              </span>
                              {setting.updated_by_name && (
                                <span>Last updated by {setting.updated_by_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {renderSettingInput(setting)}
                            <button
                              onClick={() => fetchHistory(setting.id)}
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                              title="View History"
                            >
                              <FiClock className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {Object.keys(settings).length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No settings found
            </div>
          )}
        </div>
      )}

      {/* History Modal */}
      {showHistory !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiClock className="text-orange-500" />
                Setting History
              </h2>
              <button
                onClick={() => setShowHistory(null)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((h) => (
                    <div key={h.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Version {h.version}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="text-gray-500">Previous Value</label>
                          <p className="font-mono bg-red-50 p-2 rounded mt-1 break-all">
                            {h.old_value || '(empty)'}
                          </p>
                        </div>
                        <div>
                          <label className="text-gray-500">New Value</label>
                          <p className="font-mono bg-green-50 p-2 rounded mt-1 break-all">
                            {h.new_value || '(empty)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="text-sm text-gray-500">
                          Changed by: {h.changed_by_name || 'Unknown'}
                          {h.change_reason && <span className="ml-2">• {h.change_reason}</span>}
                        </div>
                        <button
                          onClick={() => handleRollback(showHistory, h.version)}
                          className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                        >
                          <FiRefreshCw className="w-3 h-3" />
                          Rollback to this
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No history available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
