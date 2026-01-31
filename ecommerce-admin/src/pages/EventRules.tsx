import { useState, useEffect } from 'react'
import { eventRulesAPI, templatesAPI } from '../services/api'
import {
  FiPlus, FiEdit2, FiTrash2, FiPlay, FiZap, FiCheck, FiX,
  FiRefreshCw, FiClock, FiFilter, FiMail, FiSmartphone, FiBell
} from 'react-icons/fi'

interface EventRule {
  id: number
  name: string
  event_type: string
  template_id: number
  template_name: string
  conditions: any[]
  channel: string
  priority: number
  delay_minutes: number
  is_active: number
  trigger_count: number
  created_by_name: string
  created_at: string
}

interface EventType {
  type: string
  label: string
  description: string
}

interface Template {
  id: number
  name: string
  type: string
  channel: string
}

export default function EventRules() {
  const [rules, setRules] = useState<EventRule[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [selectedRule, setSelectedRule] = useState<EventRule | null>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [filterEvent, setFilterEvent] = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  
  const [formData, setFormData] = useState({
    name: '',
    event_type: '',
    template_id: 0,
    conditions: [] as any[],
    channel: 'email',
    priority: 0,
    delay_minutes: 0,
    is_active: true
  })

  const [testData, setTestData] = useState<Record<string, string>>({
    order_amount: '100',
    customer_type: 'regular',
    status: 'confirmed'
  })

  useEffect(() => {
    fetchRules()
    fetchEventTypes()
    fetchTemplates()
  }, [filterEvent, filterChannel])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filterEvent !== 'all') params.event_type = filterEvent
      if (filterChannel !== 'all') params.channel = filterChannel
      const response = await eventRulesAPI.getAll(params)
      setRules(response.data.rules || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
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

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll()
      setTemplates(response.data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleCreate = () => {
    setSelectedRule(null)
    setFormData({
      name: '',
      event_type: eventTypes[0]?.type || 'order_created',
      template_id: templates[0]?.id || 0,
      conditions: [],
      channel: 'email',
      priority: 0,
      delay_minutes: 0,
      is_active: true
    })
    setShowModal(true)
  }

  const handleEdit = async (rule: EventRule) => {
    try {
      const response = await eventRulesAPI.getById(rule.id)
      const ruleData = response.data.rule
      setSelectedRule(ruleData)
      setFormData({
        name: ruleData.name,
        event_type: ruleData.event_type,
        template_id: ruleData.template_id,
        conditions: ruleData.conditions || [],
        channel: ruleData.channel,
        priority: ruleData.priority,
        delay_minutes: ruleData.delay_minutes,
        is_active: ruleData.is_active === 1
      })
      setShowModal(true)
    } catch (error) {
      console.error('Error fetching rule:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    
    try {
      await eventRulesAPI.delete(id)
      fetchRules()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete rule')
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await eventRulesAPI.toggle(id)
      fetchRules()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedRule) {
        await eventRulesAPI.update(selectedRule.id, formData)
      } else {
        await eventRulesAPI.create(formData)
      }
      setShowModal(false)
      fetchRules()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save rule')
    }
  }

  const handleTest = async (rule: EventRule) => {
    setSelectedRule(rule)
    setTestResult(null)
    setShowTestModal(true)
  }

  const runTest = async () => {
    if (!selectedRule) return
    try {
      const response = await eventRulesAPI.test(selectedRule.id, testData)
      setTestResult(response.data.result)
    } catch (error) {
      console.error('Error testing rule:', error)
    }
  }

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: '', operator: 'equals', value: '' }]
    })
  }

  const updateCondition = (index: number, field: string, value: any) => {
    const newConditions = [...formData.conditions]
    newConditions[index] = { ...newConditions[index], [field]: value }
    setFormData({ ...formData, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index)
    })
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <FiMail className="text-blue-500" />
      case 'push': return <FiBell className="text-orange-500" />
      case 'sms': return <FiSmartphone className="text-green-500" />
      default: return <FiBell className="text-gray-500" />
    }
  }

  const getEventLabel = (type: string) => {
    const event = eventTypes.find(e => e.type === type)
    return event?.label || type.replace(/_/g, ' ')
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Trigger Rules</h1>
          <p className="text-gray-600">Map events to notification templates</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
        >
          <FiPlus /> New Rule
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="all">All Events</option>
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
          onClick={fetchRules}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Rules Table */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    {rule.conditions && rule.conditions.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <FiFilter className="text-xs" />
                        {rule.conditions.length} condition(s)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FiZap className="text-yellow-500" />
                      <span className="capitalize">{getEventLabel(rule.event_type)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700">{rule.template_name || 'No template'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(rule.channel)}
                      <span className="capitalize">{rule.channel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                      {rule.priority}
                    </span>
                    {rule.delay_minutes > 0 && (
                      <span className="ml-2 text-sm text-gray-500 flex items-center gap-1">
                        <FiClock className="text-xs" />
                        {rule.delay_minutes}m delay
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{rule.trigger_count} times</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={`flex items-center gap-1 ${
                        rule.is_active ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {rule.is_active ? <FiCheck /> : <FiX />}
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(rule)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                        title="Test Rule"
                      >
                        <FiPlay />
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No event rules found. Create your first rule!
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
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedRule ? 'Edit Rule' : 'Create Rule'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    {eventTypes.map(et => (
                      <option key={et.type} value={et.type}>{et.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select
                    value={formData.template_id}
                    onChange={(e) => setFormData({ ...formData, template_id: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
                  <input
                    type="number"
                    value={formData.delay_minutes}
                    onChange={(e) => setFormData({ ...formData, delay_minutes: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="0"
                  />
                </div>
              </div>

              {/* Conditions */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Conditions (Optional)</label>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-sm text-orange-600 hover:text-orange-800"
                  >
                    + Add Condition
                  </button>
                </div>
                {formData.conditions.map((condition, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="Field (e.g., order_amount)"
                    />
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="greater_than">greater than</option>
                      <option value="less_than">less than</option>
                      <option value="contains">contains</option>
                    </select>
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center mb-4">
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
                  {selectedRule ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl">
            <h2 className="text-xl font-bold mb-4">Test Rule: {selectedRule.name}</h2>
            
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 mb-2">Sample Data</h3>
              <div className="space-y-2">
                {Object.entries(testData).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newData = { ...testData }
                        delete newData[key]
                        newData[e.target.value] = value
                        setTestData(newData)
                      }}
                      className="w-1/3 border rounded px-2 py-1 text-sm"
                      placeholder="Field"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setTestData({ ...testData, [key]: e.target.value })}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="Value"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTestData({ ...testData, [`field_${Object.keys(testData).length + 1}`]: '' })}
                className="mt-2 text-sm text-orange-600 hover:text-orange-800"
              >
                + Add Field
              </button>
            </div>

            <button
              onClick={runTest}
              className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 mb-4"
            >
              Run Test
            </button>

            {testResult && (
              <div className={`border rounded-lg p-4 ${testResult.would_trigger ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                <div className="font-bold mb-2">
                  {testResult.would_trigger ? '✓ Rule Would Trigger' : '✗ Rule Would NOT Trigger'}
                </div>
                {testResult.condition_results && testResult.condition_results.length > 0 && (
                  <div className="mb-2">
                    <strong>Conditions:</strong>
                    {testResult.condition_results.map((cr: any, i: number) => (
                      <div key={i} className={`text-sm ${cr.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {cr.field} {cr.operator} {cr.expected}: {cr.passed ? 'PASS' : 'FAIL'} (actual: {cr.actual})
                      </div>
                    ))}
                  </div>
                )}
                {testResult.preview && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <strong>Preview:</strong>
                    <div className="text-sm"><strong>Channel:</strong> {testResult.preview.channel}</div>
                    <div className="text-sm"><strong>Subject:</strong> {testResult.preview.subject}</div>
                    <div className="text-sm mt-1">{testResult.preview.body}</div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTestModal(false)}
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
