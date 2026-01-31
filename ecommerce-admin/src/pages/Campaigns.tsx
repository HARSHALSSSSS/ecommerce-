import { useState, useEffect } from 'react'
import { campaignsAPI, templatesAPI, categoriesAPI } from '../services/api'
import {
  FiPlus, FiEdit2, FiTrash2, FiPlay, FiPause, FiUsers, FiTag,
  FiCalendar, FiPieChart, FiSettings, FiMail, FiBell, FiSmartphone,
  FiTarget, FiBarChart2, FiRefreshCw, FiCheck, FiX, FiGrid
} from 'react-icons/fi'

interface Campaign {
  id: number
  name: string
  description: string
  template_id: number
  template_name: string
  segment_id: number
  segment_name: string
  channel: string
  status: string
  scheduled_at: string
  started_at: string
  completed_at: string
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  created_at: string
}

interface Segment {
  id: number
  name: string
  description: string
  segment_type: string
  criteria: any[]
  user_count: number
  is_dynamic: number
  created_by_name: string
}

interface CategoryRule {
  id: number
  name: string
  category_id: number
  category_name: string
  template_id: number
  template_name: string
  trigger_type: string
  trigger_conditions: any
  channel: string
  frequency_cap_hours: number
  is_active: number
  requires_opt_in: number
  created_at: string
}

interface Template {
  id: number
  name: string
  type: string
  channel: string
}

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'segments' | 'category-rules'>('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showSegmentModal, setShowSegmentModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    campaign_type: 'marketing',
    template_id: 0,
    segment_type: 'all',
    segment_criteria: {} as any,
    channel: 'email',
    scheduled_at: '',
    requires_opt_in: true
  })

  const [segmentForm, setSegmentForm] = useState({
    name: '',
    description: '',
    segment_type: 'custom',
    criteria: [] as any[],
    is_dynamic: false
  })

  const [categoryRuleForm, setCategoryRuleForm] = useState({
    name: '',
    category_id: 0,
    template_id: 0,
    trigger_type: 'product_view',
    channel: 'email',
    frequency_cap_hours: 168,
    requires_opt_in: true
  })

  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    fetchData()
    fetchTemplates()
    fetchCategories()
  }, [activeTab, filterStatus])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'campaigns') {
        const params: any = {}
        if (filterStatus !== 'all') params.status = filterStatus
        const response = await campaignsAPI.getAll(params)
        setCampaigns(response.data.campaigns || [])
      } else if (activeTab === 'segments') {
        const response = await campaignsAPI.getSegments()
        setSegments(response.data.segments || [])
      } else if (activeTab === 'category-rules') {
        const response = await campaignsAPI.getCategoryRules()
        setCategoryRules(response.data.rules || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll({ type: 'marketing' })
      setTemplates(response.data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getAll()
      setCategories(response.data.categories || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      // Fallback to sample data if API fails
      setCategories([
        { id: 1, name: 'Electronics' },
        { id: 2, name: 'Clothing' },
        { id: 3, name: 'Home & Garden' },
        { id: 4, name: 'Books' },
        { id: 5, name: 'Sports' }
      ])
    }
  }

  // Campaign functions
  const handleCreateCampaign = () => {
    setSelectedCampaign(null)
    setCampaignForm({
      name: '',
      description: '',
      campaign_type: 'marketing',
      template_id: templates[0]?.id || 0,
      segment_type: 'all',
      segment_criteria: {},
      channel: 'email',
      scheduled_at: '',
      requires_opt_in: true
    })
    setShowCampaignModal(true)
  }

  const handleEditCampaign = async (campaign: Campaign) => {
    try {
      const response = await campaignsAPI.getById(campaign.id)
      const data = response.data.campaign
      setSelectedCampaign(data)
      setCampaignForm({
        name: data.name,
        description: data.description || '',
        campaign_type: data.campaign_type || 'marketing',
        template_id: data.template_id,
        segment_type: data.segment_type || 'all',
        segment_criteria: data.segment_criteria || {},
        channel: data.channel,
        scheduled_at: data.scheduled_at || '',
        requires_opt_in: data.requires_opt_in ?? true
      })
      setShowCampaignModal(true)
    } catch (error) {
      console.error('Error fetching campaign:', error)
    }
  }

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return
    try {
      await campaignsAPI.delete(id)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete campaign')
    }
  }

  const handleStartCampaign = async (id: number) => {
    try {
      await campaignsAPI.start(id)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start campaign')
    }
  }

  const handlePauseCampaign = async (id: number) => {
    try {
      await campaignsAPI.pause(id)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to pause campaign')
    }
  }

  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (selectedCampaign) {
        await campaignsAPI.update(selectedCampaign.id, campaignForm)
      } else {
        await campaignsAPI.create(campaignForm)
      }
      setShowCampaignModal(false)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save campaign')
    }
  }

  // Segment functions
  const handleCreateSegment = () => {
    setSegmentForm({
      name: '',
      description: '',
      segment_type: 'custom',
      criteria: [],
      is_dynamic: false
    })
    setShowSegmentModal(true)
  }

  const handleSubmitSegment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await campaignsAPI.createSegment(segmentForm)
      setShowSegmentModal(false)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create segment')
    }
  }

  const addSegmentCondition = () => {
    setSegmentForm({
      ...segmentForm,
      criteria: [...segmentForm.criteria, { field: '', operator: 'equals', value: '' }]
    })
  }

  const updateSegmentCondition = (index: number, field: string, value: any) => {
    const newCriteria = [...segmentForm.criteria]
    newCriteria[index] = { ...newCriteria[index], [field]: value }
    setSegmentForm({ ...segmentForm, criteria: newCriteria })
  }

  const removeSegmentCondition = (index: number) => {
    setSegmentForm({
      ...segmentForm,
      criteria: segmentForm.criteria.filter((_, i) => i !== index)
    })
  }

  // Category rule functions
  const handleCreateCategoryRule = () => {
    setCategoryRuleForm({
      name: '',
      category_id: categories[0]?.id || 0,
      template_id: templates[0]?.id || 0,
      trigger_type: 'product_view',
      channel: 'email',
      frequency_cap_hours: 168,
      requires_opt_in: true
    })
    setShowCategoryModal(true)
  }

  const handleSubmitCategoryRule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await campaignsAPI.createCategoryRule(categoryRuleForm)
      setShowCategoryModal(false)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create category rule')
    }
  }

  const handleToggleCategoryRule = async (id: number) => {
    try {
      await campaignsAPI.toggleCategoryRule(id)
      fetchData()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const handleDeleteCategoryRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    try {
      await campaignsAPI.deleteCategoryRule(id)
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete rule')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'running': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
          <p className="text-gray-600">Create and manage marketing campaigns with user segmentation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 border-b-2 ${
            activeTab === 'campaigns' 
              ? 'border-orange-500 text-orange-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiTarget className="inline mr-2" />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`px-4 py-2 border-b-2 ${
            activeTab === 'segments' 
              ? 'border-orange-500 text-orange-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiUsers className="inline mr-2" />
          Segments
        </button>
        <button
          onClick={() => setActiveTab('category-rules')}
          className={`px-4 py-2 border-b-2 ${
            activeTab === 'category-rules' 
              ? 'border-orange-500 text-orange-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiGrid className="inline mr-2" />
          Category Rules
        </button>
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <button onClick={fetchData} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <FiRefreshCw /> Refresh
              </button>
            </div>
            <button
              onClick={handleCreateCampaign}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
            >
              <FiPlus /> New Campaign
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map(campaign => (
                <div key={campaign.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {getChannelIcon(campaign.channel)}
                        <h3 className="text-lg font-bold">{campaign.name}</h3>
                        <span className={`px-2 py-1 rounded text-sm ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{campaign.description}</p>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span><FiTag className="inline mr-1" />Template: {campaign.template_name}</span>
                        <span><FiUsers className="inline mr-1" />Segment: {campaign.segment_name || 'All Users'}</span>
                        {campaign.scheduled_at && (
                          <span><FiCalendar className="inline mr-1" />Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' || campaign.status === 'paused' ? (
                        <button
                          onClick={() => handleStartCampaign(campaign.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="Start Campaign"
                        >
                          <FiPlay />
                        </button>
                      ) : campaign.status === 'active' || campaign.status === 'running' ? (
                        <button
                          onClick={() => handlePauseCampaign(campaign.id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                          title="Pause Campaign"
                        >
                          <FiPause />
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleEditCampaign(campaign)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  {(campaign.total_sent > 0) && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{campaign.total_sent}</div>
                        <div className="text-sm text-gray-500">Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{campaign.total_delivered}</div>
                        <div className="text-sm text-gray-500">Delivered</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{campaign.total_opened}</div>
                        <div className="text-sm text-gray-500">Opened</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{campaign.total_clicked}</div>
                        <div className="text-sm text-gray-500">Clicked</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {campaigns.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No campaigns found. Create your first marketing campaign!
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Segments Tab */}
      {activeTab === 'segments' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleCreateSegment}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
            >
              <FiPlus /> New Segment
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {segments.map(segment => (
                <div key={segment.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <FiUsers className="text-orange-500 text-xl" />
                    <h3 className="font-bold text-lg">{segment.name}</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{segment.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-gray-900">{segment.user_count}</span>
                    <span className="text-sm text-gray-500">users</span>
                  </div>
                  {segment.criteria && segment.criteria.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        {segment.criteria.length} condition(s)
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {segments.length === 0 && (
                <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No segments found. Create user segments for targeted campaigns!
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Category Rules Tab */}
      {activeTab === 'category-rules' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-600">Configure frequency caps per product category</p>
            <button
              onClick={handleCreateCategoryRule}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
            >
              <FiPlus /> New Rule
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency Cap</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categoryRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-gray-500 capitalize">{rule.trigger_type?.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-6 py-4">{rule.category_name || `Category ${rule.category_id}`}</td>
                      <td className="px-6 py-4">{rule.template_name || 'No template'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(rule.channel)}
                          <span className="capitalize">{rule.channel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {rule.frequency_cap_hours}h ({Math.round(rule.frequency_cap_hours / 24)}d)
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleCategoryRule(rule.id)}
                          className={`flex items-center gap-1 ${
                            rule.is_active ? 'text-green-600' : 'text-gray-400'
                          }`}
                        >
                          {rule.is_active ? <FiCheck /> : <FiX />}
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteCategoryRule(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categoryRules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No category rules found. Add rules to control marketing frequency per category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl">
            <h2 className="text-xl font-bold mb-4">
              {selectedCampaign ? 'Edit Campaign' : 'Create Campaign'}
            </h2>
            <form onSubmit={handleSubmitCampaign}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type</label>
                    <select
                      value={campaignForm.campaign_type}
                      onChange={(e) => setCampaignForm({ ...campaignForm, campaign_type: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="marketing">Marketing</option>
                      <option value="promotional">Promotional</option>
                      <option value="announcement">Announcement</option>
                      <option value="newsletter">Newsletter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                    <select
                      value={campaignForm.template_id}
                      onChange={(e) => setCampaignForm({ ...campaignForm, template_id: Number(e.target.value) })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Segment Type</label>
                    <select
                      value={campaignForm.segment_type}
                      onChange={(e) => setCampaignForm({ ...campaignForm, segment_type: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="all">All Users</option>
                      <option value="active">Active Users</option>
                      <option value="new">New Users</option>
                      <option value="inactive">Inactive Users</option>
                      <option value="custom">Custom Segment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                    <select
                      value={campaignForm.channel}
                      onChange={(e) => setCampaignForm({ ...campaignForm, channel: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="email">Email</option>
                      <option value="push">Push Notification</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                    <input
                      type="datetime-local"
                      value={campaignForm.scheduled_at}
                      onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={campaignForm.requires_opt_in}
                        onChange={(e) => setCampaignForm({ ...campaignForm, requires_opt_in: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Requires user opt-in</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  {selectedCampaign ? 'Save Changes' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Segment Modal */}
      {showSegmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl">
            <h2 className="text-xl font-bold mb-4">Create Segment</h2>
            <form onSubmit={handleSubmitSegment}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segment Name</label>
                  <input
                    type="text"
                    value={segmentForm.name}
                    onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={segmentForm.description}
                    onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Conditions</label>
                    <button
                      type="button"
                      onClick={addSegmentCondition}
                      className="text-sm text-orange-600 hover:text-orange-800"
                    >
                      + Add Condition
                    </button>
                  </div>
                  {segmentForm.criteria.map((condition, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={condition.field}
                        onChange={(e) => updateSegmentCondition(index, 'field', e.target.value)}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select field...</option>
                        <option value="total_orders">Total Orders</option>
                        <option value="total_spent">Total Spent</option>
                        <option value="last_order_date">Last Order Date</option>
                        <option value="created_at">Account Age</option>
                        <option value="city">City</option>
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateSegmentCondition(index, 'operator', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="equals">equals</option>
                        <option value="greater_than">greater than</option>
                        <option value="less_than">less than</option>
                        <option value="contains">contains</option>
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateSegmentCondition(index, 'value', e.target.value)}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => removeSegmentCondition(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSegmentModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Create Segment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Rule Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Category Rule</h2>
            <form onSubmit={handleSubmitCategoryRule}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={categoryRuleForm.name}
                    onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., Electronics Promo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={categoryRuleForm.category_id}
                    onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, category_id: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <select
                    value={categoryRuleForm.template_id}
                    onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, template_id: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                    <select
                      value={categoryRuleForm.trigger_type}
                      onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, trigger_type: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="product_view">Product View</option>
                      <option value="add_to_cart">Add to Cart</option>
                      <option value="purchase">Purchase</option>
                      <option value="wishlist">Wishlist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                    <select
                      value={categoryRuleForm.channel}
                      onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, channel: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="email">Email</option>
                      <option value="push">Push Notification</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency Cap (hours)</label>
                  <input
                    type="number"
                    value={categoryRuleForm.frequency_cap_hours}
                    onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, frequency_cap_hours: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="1"
                    placeholder="e.g., 168 for 1 week"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum hours between messages (24=1 day, 168=1 week)</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requires_opt_in"
                    checked={categoryRuleForm.requires_opt_in}
                    onChange={(e) => setCategoryRuleForm({ ...categoryRuleForm, requires_opt_in: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="requires_opt_in" className="text-sm text-gray-700">
                    Requires user opt-in
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
