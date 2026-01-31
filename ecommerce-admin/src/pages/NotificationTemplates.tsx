import { useState, useEffect } from 'react'
import { templatesAPI, eventRulesAPI } from '../services/api'
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiClock, FiCheck, FiX, 
  FiRefreshCw, FiCode, FiMail, FiSmartphone, FiBell
} from 'react-icons/fi'

interface Template {
  id: number
  name: string
  type: string
  channel: string
  subject_template: string
  body_template: string
  variables: string[]
  is_active: number
  version_count: number
  current_version: number
  created_at: string
  updated_at: string
}

interface Version {
  id: number
  template_id: number
  version: number
  subject_template: string
  body_template: string
  variables: string[]
  change_notes: string
  created_by_name: string
  is_active: number
  created_at: string
}

interface EventType {
  type: string
  label: string
  description: string
}

export default function NotificationTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [previewData, setPreviewData] = useState<any>(null)
  const [sampleData, setSampleData] = useState<Record<string, string>>({})
  const [filterType, setFilterType] = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'order_confirmation',
    channel: 'email',
    subject_template: '',
    body_template: '',
    variables: [] as string[],
    is_active: true,
    change_notes: ''
  })

  useEffect(() => {
    fetchTemplates()
    fetchEventTypes()
  }, [filterType, filterChannel])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filterType !== 'all') params.type = filterType
      if (filterChannel !== 'all') params.channel = filterChannel
      const response = await templatesAPI.getAll(params)
      setTemplates(response.data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEventTypes = async () => {
    try {
      const response = await eventRulesAPI.getEventTypes()
      setEventTypes(response.data.eventTypes || [])
    } catch (error) {
      console.error('Error fetching event types:', error)
    }
  }

  const handleCreate = () => {
    setSelectedTemplate(null)
    setFormData({
      name: '',
      type: 'order_confirmation',
      channel: 'email',
      subject_template: '',
      body_template: '',
      variables: [],
      is_active: true,
      change_notes: ''
    })
    setShowModal(true)
  }

  const handleEdit = async (template: Template) => {
    try {
      const response = await templatesAPI.getById(template.id)
      const templateData = response.data.template
      setSelectedTemplate(templateData)
      setFormData({
        name: templateData.name,
        type: templateData.type,
        channel: templateData.channel,
        subject_template: templateData.subject_template || '',
        body_template: templateData.body_template || '',
        variables: templateData.variables || [],
        is_active: templateData.is_active === 1,
        change_notes: ''
      })
      setVersions(templateData.versions || [])
      setShowModal(true)
    } catch (error) {
      console.error('Error fetching template:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      await templatesAPI.delete(id)
      fetchTemplates()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete template')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedTemplate) {
        await templatesAPI.update(selectedTemplate.id, {
          ...formData,
          is_active: formData.is_active,
          create_version: true
        })
      } else {
        await templatesAPI.create(formData)
      }
      setShowModal(false)
      fetchTemplates()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save template')
    }
  }

  const handlePreview = async (template: Template) => {
    setSelectedTemplate(template)
    // Set default sample data based on type
    const defaultData: Record<string, string> = {
      customer_name: 'John Doe',
      order_number: 'ORD-12345',
      total_amount: '$99.99',
      order_date: new Date().toLocaleDateString()
    }
    setSampleData(defaultData)
    
    try {
      const response = await templatesAPI.preview(template.id, { sample_data: defaultData })
      setPreviewData(response.data.preview)
      setShowPreview(true)
    } catch (error) {
      console.error('Error previewing template:', error)
    }
  }

  const updatePreview = async () => {
    if (!selectedTemplate) return
    try {
      const response = await templatesAPI.preview(selectedTemplate.id, { sample_data: sampleData })
      setPreviewData(response.data.preview)
    } catch (error) {
      console.error('Error updating preview:', error)
    }
  }

  const handleViewVersions = async (template: Template) => {
    try {
      const response = await templatesAPI.getById(template.id)
      setSelectedTemplate(response.data.template)
      setVersions(response.data.template.versions || [])
      setShowVersions(true)
    } catch (error) {
      console.error('Error fetching versions:', error)
    }
  }

  const handleActivateVersion = async (versionId: number) => {
    if (!selectedTemplate) return
    try {
      await templatesAPI.activateVersion(selectedTemplate.id, versionId)
      alert('Version activated successfully')
      setShowVersions(false)
      fetchTemplates()
    } catch (error) {
      console.error('Error activating version:', error)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <FiMail className="text-blue-500" />
      case 'push': return <FiBell className="text-orange-500" />
      case 'sms': return <FiSmartphone className="text-green-500" />
      default: return <FiBell className="text-gray-500" />
    }
  }

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      body_template: prev.body_template + `{{${variable}}}`
    }))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Templates</h1>
          <p className="text-gray-600">Manage notification templates with version control</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
        >
          <FiPlus /> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="all">All Types</option>
          {eventTypes.map(et => (
            <option key={et.type} value={et.type}>{et.label}</option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="all">All Channels</option>
          <option value="email">Email</option>
          <option value="push">Push</option>
          <option value="sms">SMS</option>
          <option value="in_app">In-App</option>
        </select>
        <button
          onClick={fetchTemplates}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Templates Table */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map(template => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-sm text-gray-500">{template.subject_template}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                      {template.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(template.channel)}
                      <span className="capitalize">{template.channel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleViewVersions(template)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <FiClock />
                      v{template.current_version || 1} ({template.version_count || 1})
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    {template.is_active ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <FiCheck /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <FiX /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreview(template)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Preview"
                      >
                        <FiEye />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No templates found. Create your first template!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedTemplate ? 'Edit Template' : 'Create Template'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {eventTypes.map(et => (
                      <option key={et.type} value={et.type}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="email">Email</option>
                    <option value="push">Push Notification</option>
                    <option value="sms">SMS</option>
                    <option value="in_app">In-App</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Template</label>
                <input
                  type="text"
                  value={formData.subject_template}
                  onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Order {{order_number}} Confirmed"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Template</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className="text-sm text-gray-500">Variables:</span>
                  {['customer_name', 'order_number', 'total_amount', 'order_date'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                    >
                      <FiCode className="inline mr-1" />{v}
                    </button>
                  ))}
                </div>
                <textarea
                  value={formData.body_template}
                  onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder="Hello {{customer_name}},&#10;&#10;Your order {{order_number}} has been confirmed..."
                  required
                />
              </div>

              {selectedTemplate && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Change Notes</label>
                  <input
                    type="text"
                    value={formData.change_notes}
                    onChange={(e) => setFormData({ ...formData, change_notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Describe what changed..."
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  {selectedTemplate ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Template Preview</h2>
            
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 mb-2">Sample Data</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sampleData).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      disabled
                      className="w-1/3 border rounded px-2 py-1 bg-gray-50 text-sm"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setSampleData({ ...sampleData, [key]: e.target.value })}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={updatePreview}
                className="mt-2 px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                Update Preview
              </button>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="border-b pb-2 mb-2">
                <span className="font-medium">Subject:</span>
                <span className="ml-2">{previewData.subject}</span>
              </div>
              <div className="whitespace-pre-wrap">{previewData.body}</div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Versions Modal */}
      {showVersions && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Version History - {selectedTemplate.name}
            </h2>
            
            <div className="space-y-4">
              {versions.map(version => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${version.is_active ? 'border-green-500 bg-green-50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">Version {version.version}</span>
                      {version.is_active && (
                        <span className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Change Notes:</strong> {version.change_notes || 'No notes'}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Created by:</strong> {version.created_by_name || 'System'}
                  </div>
                  <div className="text-sm bg-gray-100 p-2 rounded font-mono">
                    {version.body_template?.substring(0, 100)}...
                  </div>
                  {!version.is_active && (
                    <button
                      onClick={() => handleActivateVersion(version.id)}
                      className="mt-2 px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
                    >
                      Rollback to this version
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowVersions(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
