import { useState, useEffect } from 'react';
import api from '../services/api';

interface Refund {
  id: number;
  order_id: number;
  return_id: number | null;
  refund_number: string;
  amount: number;
  currency: string;
  reason: string;
  reason_label: string;
  payment_mode: string;
  payment_mode_label: string;
  status: string;
  status_label: string;
  transaction_id: string | null;
  bank_reference: string | null;
  notes: string | null;
  initiated_by: number;
  processed_by: number | null;
  processed_at: string | null;
  created_at: string;
  order_number: string;
  order_total: number;
  customer_name: string;
  customer_email: string;
  return_number?: string;
  initiated_by_email?: string;
  processed_by_email?: string;
  available_transitions?: { status: string; label: string }[];
}

interface RefundStats {
  total_refunds: number;
  pending: number;
  approved: number;
  processing: number;
  completed: number;
  failed: number;
  rejected: number;
  total_amount: number;
  refunded_amount: number;
  pending_amount: number;
  today: {
    created_today: number;
    completed_today: number;
    amount_today: number;
  };
  by_payment_mode: { payment_mode: string; payment_mode_label: string; count: number; total: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-800',
};

export default function Refunds() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);

  // Form states
  const [processForm, setProcessForm] = useState({
    transaction_id: '',
    bank_reference: '',
    notes: '',
  });
  const [statusForm, setStatusForm] = useState({
    new_status: '',
    notes: '',
  });

  useEffect(() => {
    fetchRefunds();
    fetchStats();
  }, [page, statusFilter, searchTerm]);

  const fetchRefunds = async () => {
    try {
      const response = await api.get('/refunds/admin', {
        params: { page, limit: 20, status: statusFilter, search: searchTerm },
      });
      if (response.data.success) {
        setRefunds(response.data.refunds);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/refunds/admin/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRefundDetail = async (id: number) => {
    try {
      const response = await api.get(`/refunds/admin/${id}`);
      if (response.data.success) {
        setSelectedRefund(response.data.refund);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching refund detail:', error);
    }
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund) return;

    try {
      const response = await api.put(`/refunds/admin/${selectedRefund.id}/process`, processForm);
      if (response.data.success) {
        setShowProcessModal(false);
        setProcessForm({ transaction_id: '', bank_reference: '', notes: '' });
        fetchRefundDetail(selectedRefund.id);
        fetchRefunds();
        fetchStats();
        alert('Refund processed successfully');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to process refund');
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund || !statusForm.new_status) return;

    try {
      const response = await api.put(`/refunds/admin/${selectedRefund.id}/status`, statusForm);
      if (response.data.success) {
        setStatusForm({ new_status: '', notes: '' });
        fetchRefundDetail(selectedRefund.id);
        fetchRefunds();
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
        <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
        <p className="text-gray-600">Process and track customer refunds</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-gray-900">{stats.total_refunds}</p>
            <p className="text-sm text-gray-600">Total Refunds</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-xs text-gray-500">${stats.pending_amount?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-indigo-600">{stats.processing}</p>
            <p className="text-sm text-gray-600">Processing</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-xs text-gray-500">${stats.refunded_amount?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-red-600">{stats.failed + stats.rejected}</p>
            <p className="text-sm text-gray-600">Failed/Rejected</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-blue-600">${stats.total_amount?.toFixed(2) || '0.00'}</p>
            <p className="text-sm text-gray-600">Total Amount</p>
          </div>
        </div>
      )}

      {/* Today's Summary */}
      {stats?.today && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-lg shadow mb-6">
          <h3 className="font-medium mb-2">Today's Summary</h3>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold">{stats.today.created_today}</p>
              <p className="text-sm opacity-90">New Refunds</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.today.completed_today}</p>
              <p className="text-sm opacity-90">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">${stats.today.amount_today?.toFixed(2) || '0.00'}</p>
              <p className="text-sm opacity-90">Amount Refunded</p>
            </div>
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
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by refund/order number or customer..."
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

      {/* Refunds Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : refunds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No refunds found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Refund #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Payment Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {refunds.map((refund) => (
                <tr key={refund.id} className={`hover:bg-gray-50 ${refund.status === 'pending' ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{refund.refund_number}</span>
                    {refund.return_number && (
                      <p className="text-xs text-gray-500">Return: {refund.return_number}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600">{refund.order_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{refund.customer_name}</p>
                    <p className="text-xs text-gray-500">{refund.customer_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-green-600">
                      {refund.currency} {refund.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{refund.reason_label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{refund.payment_mode_label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[refund.status] || 'bg-gray-100'}`}>
                      {refund.status_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(refund.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchRefundDetail(refund.id)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        View
                      </button>
                      {['pending', 'approved'].includes(refund.status) && (
                        <button
                          onClick={() => {
                            setSelectedRefund(refund);
                            setShowProcessModal(true);
                          }}
                          className="text-green-600 hover:text-green-900 text-sm font-medium"
                        >
                          Process
                        </button>
                      )}
                    </div>
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
      {showDetailModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedRefund.refund_number}</h2>
                <p className="text-gray-600">Order: {selectedRefund.order_number}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status & Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[selectedRefund.status] || 'bg-gray-100'}`}>
                {selectedRefund.status_label}
              </span>
              
              {['pending', 'approved'].includes(selectedRefund.status) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowProcessModal(true);
                  }}
                  className="px-4 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  💰 Process Refund
                </button>
              )}
            </div>

            {/* Amount Highlight */}
            <div className="bg-green-50 p-4 rounded-lg mb-6 text-center">
              <p className="text-sm text-gray-600">Refund Amount</p>
              <p className="text-3xl font-bold text-green-600">
                {selectedRefund.currency} {selectedRefund.amount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">of ${selectedRefund.order_total?.toFixed(2)} order total</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{selectedRefund.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedRefund.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reason</p>
                <p className="font-medium">{selectedRefund.reason_label}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Mode</p>
                <p className="font-medium">{selectedRefund.payment_mode_label}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Initiated By</p>
                <p className="font-medium">{selectedRefund.initiated_by_email || 'N/A'}</p>
              </div>
              {selectedRefund.return_number && (
                <div>
                  <p className="text-sm text-gray-600">Linked Return</p>
                  <p className="font-medium font-mono">{selectedRefund.return_number}</p>
                </div>
              )}
              {selectedRefund.transaction_id && (
                <div>
                  <p className="text-sm text-gray-600">Transaction ID</p>
                  <p className="font-medium font-mono">{selectedRefund.transaction_id}</p>
                </div>
              )}
              {selectedRefund.bank_reference && (
                <div>
                  <p className="text-sm text-gray-600">Bank Reference</p>
                  <p className="font-medium font-mono">{selectedRefund.bank_reference}</p>
                </div>
              )}
              {selectedRefund.processed_at && (
                <div>
                  <p className="text-sm text-gray-600">Processed At</p>
                  <p className="font-medium">{formatDate(selectedRefund.processed_at)}</p>
                  {selectedRefund.processed_by_email && (
                    <p className="text-sm text-gray-500">by {selectedRefund.processed_by_email}</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedRefund.notes && (
              <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-sm">{selectedRefund.notes}</p>
              </div>
            )}

            {/* Status Update */}
            {selectedRefund.available_transitions && selectedRefund.available_transitions.length > 0 && (
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
                    {selectedRefund.available_transitions.map((t) => (
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

      {/* Process Refund Modal */}
      {showProcessModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Process Refund</h2>
            <div className="bg-green-50 p-3 rounded-lg mb-4 text-center">
              <p className="text-sm text-gray-600">Amount to Refund</p>
              <p className="text-2xl font-bold text-green-600">
                {selectedRefund.currency} {selectedRefund.amount.toFixed(2)}
              </p>
            </div>
            <form onSubmit={handleProcess} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <input
                  type="text"
                  value={processForm.transaction_id}
                  onChange={(e) => setProcessForm({ ...processForm, transaction_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Payment gateway transaction ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={processForm.bank_reference}
                  onChange={(e) => setProcessForm({ ...processForm, bank_reference: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Bank reference number (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={processForm.notes}
                  onChange={(e) => setProcessForm({ ...processForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Processing notes..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Complete Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
