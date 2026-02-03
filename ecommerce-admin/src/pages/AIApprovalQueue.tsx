import { useState, useEffect } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  Image,
  FileText,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { aiAPI } from '../services/api'
import toast from 'react-hot-toast'

interface Generation {
  id: number
  type: 'image' | 'description'
  prompt: string
  generated_content: string
  generated_image_url?: string
  status: string
  created_at: string
  product_id?: number
  product_name?: string
  requester_name?: string
  tokens_used?: number
  cost_usd?: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AIApprovalQueue() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    loadGenerations()
  }, [pagination.page, statusFilter, typeFilter])

  const loadGenerations = async () => {
    try {
      setLoading(true)
      const response = await aiAPI.getGenerations({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      })

      setGenerations(response.data.generations || [])
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination,
      }))
    } catch (error) {
      console.error('Error loading generations:', error)
      toast.error('Failed to load generations')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (generation: Generation, notes?: string) => {
    setApproving(true)
    try {
      const response = await aiAPI.approve(generation.id, notes)
      if (response.data.success) {
        toast.success('Generation approved successfully!')
        loadGenerations()
        setSelectedGeneration(null)
      } else {
        toast.error(response.data.message || 'Approval failed')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedGeneration || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    setRejecting(true)
    try {
      const response = await aiAPI.reject(selectedGeneration.id, rejectReason)
      if (response.data.success) {
        toast.success('Generation rejected')
        loadGenerations()
        setSelectedGeneration(null)
        setShowRejectModal(false)
        setRejectReason('')
      } else {
        toast.error(response.data.message || 'Rejection failed')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject')
    } finally {
      setRejecting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { icon: any; bg: string; text: string }> = {
      pending: { icon: Clock, bg: 'bg-yellow-100', text: 'text-yellow-800' },
      approved: { icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-800' },
      rejected: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-800' },
    }
    const { icon: Icon, bg, text } = config[status] || config.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
        <Icon className="w-3.5 h-3.5" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const config: Record<string, { icon: any; bg: string; text: string }> = {
      image: { icon: Image, bg: 'bg-purple-100', text: 'text-purple-800' },
      description: { icon: FileText, bg: 'bg-blue-100', text: 'text-blue-800' },
    }
    const { icon: Icon, bg, text } = config[type] || { icon: FileText, bg: 'bg-gray-100', text: 'text-gray-800' }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
        <Icon className="w-3.5 h-3.5" />
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    )
  }

  const pendingCount = generations.filter(g => g.status === 'pending').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-yellow-600" />
            AI Approval Queue
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve AI-generated content
          </p>
        </div>
        <button
          onClick={loadGenerations}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {statusFilter === 'pending' && pendingCount > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-yellow-800">
            <span className="font-semibold">{pendingCount} items</span> awaiting your approval
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="">All Types</option>
            <option value="image">Image Prompts</option>
            <option value="description">Descriptions</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm">Adjust your filters or wait for new generations</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Content Preview</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Requester</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {generations.map((gen) => (
                    <tr key={gen.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        {getTypeBadge(gen.type)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700 max-w-xs truncate">
                          {gen.generated_content}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {gen.product_name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {gen.requester_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(gen.status)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {new Date(gen.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedGeneration(gen)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {gen.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(gen)}
                                disabled={approving}
                                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedGeneration(gen)
                                  setShowRejectModal(true)
                                }}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedGeneration && !showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Generation Details</h2>
                <button
                  onClick={() => setSelectedGeneration(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {getTypeBadge(selectedGeneration.type)}
                {getStatusBadge(selectedGeneration.status)}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Original Prompt</p>
                <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">{selectedGeneration.prompt}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Generated Content</p>
                <div className="text-gray-800 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                  {selectedGeneration.generated_content}
                </div>
              </div>

              {selectedGeneration.generated_image_url && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Generated Image</p>
                  <div className="bg-gray-100 rounded-lg p-3 flex justify-center">
                    <img 
                      src={selectedGeneration.generated_image_url} 
                      alt="Generated" 
                      className="max-w-full max-h-96 rounded shadow-md"
                    />
                  </div>
                </div>
              )}

              {selectedGeneration.product_name && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Product</p>
                  <p className="text-gray-800">{selectedGeneration.product_name}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Requested By</p>
                  <p className="text-gray-800">{selectedGeneration.requester_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Date</p>
                  <p className="text-gray-800">
                    {new Date(selectedGeneration.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedGeneration.tokens_used && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Tokens Used</p>
                    <p className="text-gray-800">{selectedGeneration.tokens_used}</p>
                  </div>
                  {selectedGeneration.cost_usd && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Cost</p>
                      <p className="text-gray-800">${selectedGeneration.cost_usd.toFixed(4)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedGeneration.status === 'pending' && (
              <div className="p-6 border-t border-gray-200 flex items-center gap-3">
                <button
                  onClick={() => handleApprove(selectedGeneration)}
                  disabled={approving}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                >
                  {approving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedGeneration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Reject Generation</h2>
              <p className="text-sm text-gray-600 mt-1">Please provide a reason for rejection</p>
            </div>

            <div className="p-6">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[120px]"
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 transition-colors"
              >
                {rejecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
