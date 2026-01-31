import { useState, useEffect } from 'react';
import api from '../services/api';

interface Replacement {
  id: number;
  original_order_id: number;
  replacement_order_id: number | null;
  return_id: number | null;
  replacement_number: string;
  reason: string;
  reason_label: string;
  status: string;
  status_label: string;
  items: any[];
  notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  original_order_number: string;
  original_order_total: number;
  replacement_order_number: string | null;
  replacement_order_status: string | null;
  customer_name: string;
  customer_email: string;
  return_number?: string;
  available_transitions?: { status: string; label: string }[];
}

interface ReplacementStats {
  total_replacements: number;
  pending: number;
  approved: number;
  processing: number;
  in_transit: number;
  completed: number;
  rejected: number;
  today: {
    created_today: number;
    approved_today: number;
    completed_today: number;
  };
  by_reason: { reason: string; reason_label: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function Replacements() {
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [stats, setStats] = useState<ReplacementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState<Replacement | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Form states
  const [approveForm, setApproveForm] = useState({ notes: '', create_order: true });
  const [rejectForm, setRejectForm] = useState({ notes: '' });
  const [statusForm, setStatusForm] = useState({ new_status: '', notes: '' });

  useEffect(() => {
    fetchReplacements();
    fetchStats();
  }, [page, statusFilter, searchTerm]);

  const fetchReplacements = async () => {
    try {
      const response = await api.get('/replacements/admin', {
        params: { page, limit: 20, status: statusFilter, search: searchTerm },
      });
      if (response.data.success) {
        setReplacements(response.data.replacements);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching replacements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/replacements/admin/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReplacementDetail = async (id: number) => {
    try {
      const response = await api.get(`/replacements/admin/${id}`);
      if (response.data.success) {
        setSelectedReplacement(response.data.replacement);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching replacement detail:', error);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReplacement) return;

    try {
      const response = await api.put(`/replacements/admin/${selectedReplacement.id}/approve`, approveForm);
      if (response.data.success) {
        setShowApproveModal(false);
        setApproveForm({ notes: '', create_order: true });
        fetchReplacementDetail(selectedReplacement.id);
        fetchReplacements();
        fetchStats();
        if (response.data.replacement_order_number) {
          alert(`Replacement approved! New order: ${response.data.replacement_order_number}`);
        } else {
          alert('Replacement approved successfully');
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve replacement');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReplacement || !rejectForm.notes) return;

    try {
      const response = await api.put(`/replacements/admin/${selectedReplacement.id}/reject`, rejectForm);
      if (response.data.success) {
        setShowRejectModal(false);
        setRejectForm({ notes: '' });
        fetchReplacementDetail(selectedReplacement.id);
        fetchReplacements();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject replacement');
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReplacement || !statusForm.new_status) return;

    try {
      const response = await api.put(`/replacements/admin/${selectedReplacement.id}/status`, statusForm);
      if (response.data.success) {
        setStatusForm({ new_status: '', notes: '' });
        fetchReplacementDetail(selectedReplacement.id);
        fetchReplacements();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
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
        <h1 className="text-2xl font-bold text-gray-900">Replacement Orders</h1>
        <p className="text-gray-600">Manage product replacement requests</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-gray-900">{stats.total_replacements}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
            <p className="text-sm text-gray-600">Approved</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-indigo-600">{stats.processing}</p>
            <p className="text-sm text-gray-600">Processing</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-purple-600">{stats.in_transit}</p>
            <p className="text-sm text-gray-600">In Transit</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-gray-600">Rejected</p>
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
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by replacement/order number or customer..."
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

      {/* Replacements Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : replacements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No replacement orders found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Replacement #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Original Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">New Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {replacements.map((rpl) => (
                <tr key={rpl.id} className={`hover:bg-gray-50 ${rpl.status === 'pending' ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{rpl.replacement_number}</span>
                    {rpl.return_number && (
                      <p className="text-xs text-gray-500">Return: {rpl.return_number}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600">{rpl.original_order_number}</span>
                    <p className="text-xs text-gray-500">${rpl.original_order_total?.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{rpl.customer_name}</p>
                    <p className="text-xs text-gray-500">{rpl.customer_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{rpl.reason_label}</span>
                  </td>
                  <td className="px-6 py-4">
                    {rpl.replacement_order_number ? (
                      <div>
                        <span className="font-mono text-sm text-green-600">{rpl.replacement_order_number}</span>
                        <p className="text-xs text-gray-500">{rpl.replacement_order_status}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Not created</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[rpl.status] || 'bg-gray-100'}`}>
                      {rpl.status_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(rpl.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => fetchReplacementDetail(rpl.id)}
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
      {showDetailModal && selectedReplacement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedReplacement.replacement_number}</h2>
                <p className="text-gray-600">Original: {selectedReplacement.original_order_number}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[selectedReplacement.status] || 'bg-gray-100'}`}>
                {selectedReplacement.status_label}
              </span>
              
              {selectedReplacement.status === 'pending' && (
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
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{selectedReplacement.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedReplacement.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Original Order Total</p>
                <p className="font-medium">${selectedReplacement.original_order_total?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reason</p>
                <p className="font-medium">{selectedReplacement.reason_label}</p>
              </div>
              {selectedReplacement.return_number && (
                <div>
                  <p className="text-sm text-gray-600">Linked Return</p>
                  <p className="font-medium font-mono">{selectedReplacement.return_number}</p>
                </div>
              )}
              {selectedReplacement.replacement_order_number && (
                <div>
                  <p className="text-sm text-gray-600">New Order</p>
                  <p className="font-medium font-mono text-green-600">{selectedReplacement.replacement_order_number}</p>
                  <p className="text-xs text-gray-500">Status: {selectedReplacement.replacement_order_status}</p>
                </div>
              )}
              {selectedReplacement.approved_at && (
                <div>
                  <p className="text-sm text-gray-600">Approved At</p>
                  <p className="font-medium">{formatDate(selectedReplacement.approved_at)}</p>
                </div>
              )}
            </div>

            {/* Items */}
            {selectedReplacement.items && selectedReplacement.items.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium mb-2">Replacement Items</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  {selectedReplacement.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.name || item.product_name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity || 1}</p>
                      </div>
                      <p className="text-sm font-medium">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedReplacement.notes && (
              <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-sm">{selectedReplacement.notes}</p>
              </div>
            )}

            {/* Status Update */}
            {selectedReplacement.available_transitions && selectedReplacement.available_transitions.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">Update Status</h3>
                <form onSubmit={handleStatusUpdate} className="flex gap-3">
                  <select
                    value={statusForm.new_status}
                    onChange={(e) => setStatusForm({ ...statusForm, new_status: e.target.value })}
                    required
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="">Select new status</option>
                    {selectedReplacement.available_transitions.map((t) => (
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
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedReplacement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Approve Replacement</h2>
            <form onSubmit={handleApprove} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create_order"
                  checked={approveForm.create_order}
                  onChange={(e) => setApproveForm({ ...approveForm, create_order: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="create_order" className="text-sm font-medium text-gray-700">
                  Create replacement order automatically
                </label>
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
                  Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedReplacement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reject Replacement</h2>
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
                  Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
