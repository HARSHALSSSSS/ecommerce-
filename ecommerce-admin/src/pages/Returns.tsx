import { useState, useEffect } from 'react';
import api from '../services/api';

interface ReturnRequest {
  id: number;
  order_id: number;
  user_id: number;
  return_number: string;
  reason_code: string;
  reason_label: string;
  reason_text: string | null;
  requested_action: string;
  action_label: string;
  status: string;
  status_label: string;
  items: any[];
  images: string[];
  pickup_address: string | null;
  pickup_scheduled: string | null;
  pickup_carrier: string | null;
  admin_notes: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  order_number: string;
  order_total: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  timeline?: ReturnEvent[];
  refund?: any;
  replacement?: any;
  available_transitions?: { status: string; label: string }[];
}

interface ReturnEvent {
  event_type: string;
  previous_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

interface ReturnStats {
  total_returns: number;
  pending: number;
  approved: number;
  rejected: number;
  in_process: number;
  completed: number;
  refund_requests: number;
  replacement_requests: number;
  today: {
    created_today: number;
    approved_today: number;
    completed_today: number;
  };
  by_reason: { reason_code: string; reason_label: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  more_info_needed: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pickup_scheduled: 'bg-blue-100 text-blue-800',
  pickup_failed: 'bg-red-100 text-red-800',
  awaiting_return: 'bg-purple-100 text-purple-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  received: 'bg-teal-100 text-teal-800',
  inspecting: 'bg-cyan-100 text-cyan-800',
  inspection_passed: 'bg-green-100 text-green-800',
  inspection_failed: 'bg-red-100 text-red-800',
  refund_initiated: 'bg-blue-100 text-blue-800',
  refund_partial: 'bg-blue-100 text-blue-800',
  replacement_initiated: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
};

export default function Returns() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);

  // Form states
  const [approveForm, setApproveForm] = useState({
    notes: '',
    pickup_scheduled: '',
    pickup_carrier: '',
  });
  const [rejectForm, setRejectForm] = useState({ notes: '' });
  const [refundForm, setRefundForm] = useState({
    amount: '',
    payment_mode: 'original',
    notes: '',
  });
  const [statusForm, setStatusForm] = useState({
    new_status: '',
    notes: '',
  });

  useEffect(() => {
    fetchReturns();
    fetchStats();
  }, [page, statusFilter, searchTerm]);

  const fetchReturns = async () => {
    try {
      const response = await api.get('/returns/admin', {
        params: { page, limit: 20, status: statusFilter, search: searchTerm },
      });
      if (response.data.success) {
        setReturns(response.data.returns);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/returns/admin/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReturnDetail = async (id: number) => {
    try {
      const response = await api.get(`/returns/admin/${id}`);
      if (response.data.success) {
        setSelectedReturn(response.data.return_request);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching return detail:', error);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;

    try {
      const response = await api.put(`/returns/admin/${selectedReturn.id}/approve`, approveForm);
      if (response.data.success) {
        setShowApproveModal(false);
        setApproveForm({ notes: '', pickup_scheduled: '', pickup_carrier: '' });
        fetchReturnDetail(selectedReturn.id);
        fetchReturns();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve return');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn || !rejectForm.notes) return;

    try {
      const response = await api.put(`/returns/admin/${selectedReturn.id}/reject`, rejectForm);
      if (response.data.success) {
        setShowRejectModal(false);
        setRejectForm({ notes: '' });
        fetchReturnDetail(selectedReturn.id);
        fetchReturns();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject return');
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn || !statusForm.new_status) return;

    try {
      const response = await api.put(`/returns/admin/${selectedReturn.id}/status`, statusForm);
      if (response.data.success) {
        setStatusForm({ new_status: '', notes: '' });
        fetchReturnDetail(selectedReturn.id);
        fetchReturns();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleInitiateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;

    try {
      const response = await api.post('/refunds/admin', {
        order_id: selectedReturn.order_id,
        return_id: selectedReturn.id,
        amount: Number(refundForm.amount),
        reason: 'return',
        payment_mode: refundForm.payment_mode,
        notes: refundForm.notes,
      });
      if (response.data.success) {
        setShowRefundModal(false);
        setRefundForm({ amount: '', payment_mode: 'original', notes: '' });
        fetchReturnDetail(selectedReturn.id);
        fetchReturns();
        fetchStats();
        alert('Refund initiated successfully');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to initiate refund');
    }
  };

  const handleCreateReplacement = async () => {
    if (!selectedReturn) return;

    try {
      const response = await api.post('/replacements/admin', {
        original_order_id: selectedReturn.order_id,
        return_id: selectedReturn.id,
        reason: selectedReturn.reason_code,
        items: selectedReturn.items,
        auto_approve: true,
      });
      if (response.data.success) {
        setShowReplacementModal(false);
        fetchReturnDetail(selectedReturn.id);
        fetchReturns();
        fetchStats();
        alert(`Replacement order created: ${response.data.replacement.replacement_number}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create replacement');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Return Requests</h1>
        <p className="text-gray-600">Manage customer return requests</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-gray-900">{stats.total_returns}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-sm text-gray-600">Approved</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-blue-600">{stats.in_process}</p>
            <p className="text-sm text-gray-600">Processing</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-gray-600">Rejected</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-indigo-600">{stats.refund_requests}</p>
            <p className="text-sm text-gray-600">Refund Req.</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-purple-600">{stats.replacement_requests}</p>
            <p className="text-sm text-gray-600">Replacement</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="inspecting">Inspecting</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by return/order number or customer..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <button
          onClick={() => { setStatusFilter('all'); setSearchTerm(''); setPage(1); }}
          className="text-gray-600 hover:text-gray-900"
        >
          Clear Filters
        </button>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No return requests found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Return #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {returns.map((ret) => (
                <tr key={ret.id} className={`hover:bg-gray-50 ${ret.status === 'pending' ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{ret.return_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600">{ret.order_number}</span>
                    <p className="text-xs text-gray-500">${ret.order_total?.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{ret.customer_name}</p>
                    <p className="text-xs text-gray-500">{ret.customer_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{ret.reason_label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      ret.requested_action === 'refund' ? 'bg-green-100 text-green-800' :
                      ret.requested_action === 'replacement' ? 'bg-purple-100 text-purple-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {ret.action_label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[ret.status] || 'bg-gray-100'}`}>
                      {ret.status_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(ret.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => fetchReturnDetail(ret.id)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedReturn.return_number}</h2>
                <p className="text-gray-600">Order: {selectedReturn.order_number}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[selectedReturn.status] || 'bg-gray-100'}`}>
                {selectedReturn.status_label}
              </span>
              
              {selectedReturn.status === 'pending' && (
                <>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="px-4 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                  >
                    ✗ Reject
                  </button>
                </>
              )}
              
              {selectedReturn.status === 'inspection_passed' && !selectedReturn.refund && !selectedReturn.replacement && (
                <>
                  {selectedReturn.requested_action === 'refund' && (
                    <button
                      onClick={() => {
                        setRefundForm({ ...refundForm, amount: selectedReturn.order_total?.toString() || '' });
                        setShowRefundModal(true);
                      }}
                      className="px-4 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      💰 Initiate Refund
                    </button>
                  )}
                  {selectedReturn.requested_action === 'replacement' && (
                    <button
                      onClick={() => setShowReplacementModal(true)}
                      className="px-4 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                    >
                      🔄 Create Replacement
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{selectedReturn.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedReturn.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Total</p>
                <p className="font-medium">${selectedReturn.order_total?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Requested Action</p>
                <p className="font-medium">{selectedReturn.action_label}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reason</p>
                <p className="font-medium">{selectedReturn.reason_label}</p>
                {selectedReturn.reason_text && (
                  <p className="text-sm text-gray-500 mt-1">"{selectedReturn.reason_text}"</p>
                )}
              </div>
              {selectedReturn.pickup_address && (
                <div>
                  <p className="text-sm text-gray-600">Pickup Address</p>
                  <p className="font-medium">{selectedReturn.pickup_address}</p>
                </div>
              )}
              {selectedReturn.admin_notes && (
                <div>
                  <p className="text-sm text-gray-600">Admin Notes</p>
                  <p className="text-sm">{selectedReturn.admin_notes}</p>
                </div>
              )}
            </div>

            {/* Linked Refund */}
            {selectedReturn.refund && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Linked Refund</h4>
                <p className="text-sm">Refund #{selectedReturn.refund.refund_number} - ${selectedReturn.refund.amount}</p>
                <p className="text-xs text-gray-600">Status: {selectedReturn.refund.status}</p>
              </div>
            )}

            {/* Linked Replacement */}
            {selectedReturn.replacement && (
              <div className="mb-6 p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">Linked Replacement</h4>
                <p className="text-sm">Replacement #{selectedReturn.replacement.replacement_number}</p>
                {selectedReturn.replacement.replacement_order_number && (
                  <p className="text-xs text-gray-600">New Order: {selectedReturn.replacement.replacement_order_number}</p>
                )}
              </div>
            )}

            {/* Status Update */}
            {selectedReturn.available_transitions && selectedReturn.available_transitions.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">Update Status</h3>
                <form onSubmit={handleStatusUpdate} className="flex gap-3">
                  <select
                    value={statusForm.new_status}
                    onChange={(e) => setStatusForm({ ...statusForm, new_status: e.target.value })}
                    required
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="">Select new status</option>
                    {selectedReturn.available_transitions.map((t) => (
                      <option key={t.status} value={t.status}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={statusForm.notes}
                    onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update
                  </button>
                </form>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="font-medium mb-3">Activity Timeline</h3>
              {selectedReturn.timeline && selectedReturn.timeline.length > 0 ? (
                <div className="space-y-3">
                  {selectedReturn.timeline.map((event, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        {index < selectedReturn.timeline!.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-medium capitalize">{event.event_type.replace('_', ' ')}</span>
                            {event.notes && <p className="text-sm text-gray-600 mt-0.5">{event.notes}</p>}
                          </div>
                          <span className="text-xs text-gray-500">{formatDate(event.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Approve Return</h2>
            <form onSubmit={handleApprove} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={approveForm.pickup_scheduled}
                  onChange={(e) => setApproveForm({ ...approveForm, pickup_scheduled: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Carrier</label>
                <input
                  type="text"
                  value={approveForm.pickup_carrier}
                  onChange={(e) => setApproveForm({ ...approveForm, pickup_carrier: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., FedEx, UPS"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={approveForm.notes}
                  onChange={(e) => setApproveForm({ ...approveForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reject Return</h2>
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectForm.notes}
                  onChange={(e) => setRejectForm({ notes: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Please provide a reason for rejection..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Initiate Refund</h2>
            <form onSubmit={handleInitiateRefund} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  max={selectedReturn.order_total}
                />
                <p className="text-xs text-gray-500 mt-1">Max: ${selectedReturn.order_total?.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={refundForm.payment_mode}
                  onChange={(e) => setRefundForm({ ...refundForm, payment_mode: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="original">Original Payment Method</option>
                  <option value="wallet">Store Credit/Wallet</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={refundForm.notes}
                  onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Initiate Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replacement Confirmation Modal */}
      {showReplacementModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create Replacement Order</h2>
            <p className="text-gray-600 mb-4">
              This will create a new order for the customer with the same items as the original order.
            </p>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm"><strong>Original Order:</strong> {selectedReturn.order_number}</p>
              <p className="text-sm"><strong>Items:</strong> {selectedReturn.items?.length || 0} items</p>
              <p className="text-sm"><strong>Amount:</strong> ${selectedReturn.order_total?.toFixed(2)}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReplacementModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReplacement}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Replacement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
