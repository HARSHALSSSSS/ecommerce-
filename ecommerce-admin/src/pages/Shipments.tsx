import { useState, useEffect } from 'react';
import api from '../services/api';

interface Shipment {
  id: number;
  order_id: number;
  shipment_number: string;
  courier_id: string;
  courier_name: string;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  weight: string | null;
  dimensions: string | null;
  shipping_cost: number | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  created_at: string;
  order_number: string;
  order_total: number;
  order_status: string;
  customer_name: string;
  customer_email: string;
  timeline?: ShipmentEvent[];
  available_transitions?: { status: string; label: string }[];
}

interface ShipmentEvent {
  id: number;
  status: string;
  location: string | null;
  description: string;
  event_time: string;
}

interface Courier {
  id: number;
  code: string;
  name: string;
  tracking_url_template: string;
}

interface ShipmentStats {
  total_shipments: number;
  pending: number;
  picked_up: number;
  in_transit: number;
  out_for_delivery: number;
  delivered: number;
  issues: number;
  returned: number;
  total_shipping_cost: number;
  today: {
    created_today: number;
    delivered_today: number;
  };
}

interface Order {
  id: number;
  order_number: string;
  status: string;
  total_amount: number;
  customer_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  picked_up: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  at_facility: 'bg-purple-100 text-purple-800',
  out_for_delivery: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  failed_attempt: 'bg-red-100 text-red-800',
  delayed: 'bg-red-100 text-red-800',
  returned_to_sender: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  at_facility: 'At Facility',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed_attempt: 'Failed Attempt',
  delayed: 'Delayed',
  returned_to_sender: 'Returned',
  cancelled: 'Cancelled',
};

export default function Shipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<ShipmentStats | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Create shipment form
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [createForm, setCreateForm] = useState({
    order_id: '',
    courier_id: '',
    tracking_number: '',
    weight: '',
    dimensions: '',
    shipping_cost: '',
    estimated_delivery: '',
    notes: '',
  });

  // Update status form
  const [updateForm, setUpdateForm] = useState({
    new_status: '',
    location: '',
    description: '',
  });

  useEffect(() => {
    fetchShipments();
    fetchStats();
    fetchCouriers();
  }, [page, statusFilter, searchTerm]);

  const fetchShipments = async () => {
    try {
      const response = await api.get('/admin/shipments', {
        params: { page, limit: 20, status: statusFilter, search: searchTerm },
      });
      if (response.data.success) {
        setShipments(response.data.shipments);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/shipments/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCouriers = async () => {
    try {
      const response = await api.get('/admin/couriers');
      if (response.data.success) {
        setCouriers(response.data.couriers);
      }
    } catch (error) {
      console.error('Error fetching couriers:', error);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const response = await api.get('/admin/orders', {
        params: { status: 'processing,ready_for_shipping', limit: 100 },
      });
      if (response.data.success) {
        setAvailableOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchShipmentDetail = async (id: number) => {
    try {
      const response = await api.get(`/admin/shipments/${id}`);
      if (response.data.success) {
        setSelectedShipment(response.data.shipment);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching shipment detail:', error);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/shipments', {
        ...createForm,
        order_id: Number(createForm.order_id),
        shipping_cost: createForm.shipping_cost ? Number(createForm.shipping_cost) : null,
      });
      if (response.data.success) {
        setShowCreateModal(false);
        setCreateForm({
          order_id: '',
          courier_id: '',
          tracking_number: '',
          weight: '',
          dimensions: '',
          shipping_cost: '',
          estimated_delivery: '',
          notes: '',
        });
        fetchShipments();
        fetchStats();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create shipment');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment || !updateForm.new_status) return;

    try {
      const response = await api.put(`/admin/shipments/${selectedShipment.id}/status`, updateForm);
      if (response.data.success) {
        fetchShipmentDetail(selectedShipment.id);
        fetchShipments();
        fetchStats();
        setUpdateForm({ new_status: '', location: '', description: '' });
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const openCreateModal = () => {
    fetchAvailableOrders();
    setShowCreateModal(true);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipment Management</h1>
          <p className="text-gray-600">Track and manage order shipments</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Shipment
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-gray-900">{stats.total_shipments}</p>
            <p className="text-sm text-gray-600">Total</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-blue-600">{stats.picked_up}</p>
            <p className="text-sm text-gray-600">Picked Up</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-indigo-600">{stats.in_transit}</p>
            <p className="text-sm text-gray-600">In Transit</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-orange-600">{stats.out_for_delivery}</p>
            <p className="text-sm text-gray-600">Out for Delivery</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            <p className="text-sm text-gray-600">Delivered</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-red-600">{stats.issues}</p>
            <p className="text-sm text-gray-600">Issues</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg shadow">
            <p className="text-2xl font-bold text-purple-600">${stats.total_shipping_cost?.toFixed(2) || '0.00'}</p>
            <p className="text-sm text-gray-600">Total Cost</p>
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
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by shipment/tracking/order number..."
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

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No shipments found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Shipment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Courier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Tracking</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{shipment.shipment_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600">{shipment.order_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{shipment.customer_name}</p>
                    <p className="text-xs text-gray-500">{shipment.customer_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{shipment.courier_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    {shipment.tracking_number ? (
                      shipment.tracking_url ? (
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline font-mono"
                        >
                          {shipment.tracking_number}
                        </a>
                      ) : (
                        <span className="font-mono text-sm">{shipment.tracking_number}</span>
                      )
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[shipment.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[shipment.status] || shipment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(shipment.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => fetchShipmentDetail(shipment.id)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      View Details
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

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create Shipment</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order *</label>
                <select
                  value={createForm.order_id}
                  onChange={(e) => setCreateForm({ ...createForm, order_id: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select an order</option>
                  {availableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.order_number} - {order.customer_name} (${order.total_amount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Courier *</label>
                <select
                  value={createForm.courier_id}
                  onChange={(e) => setCreateForm({ ...createForm, courier_id: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select a courier</option>
                  {couriers.map((courier) => (
                    <option key={courier.code} value={courier.code}>{courier.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={createForm.tracking_number}
                  onChange={(e) => setCreateForm({ ...createForm, tracking_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., 1Z999AA10123456784"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                  <input
                    type="text"
                    value={createForm.weight}
                    onChange={(e) => setCreateForm({ ...createForm, weight: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., 2.5 kg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
                  <input
                    type="text"
                    value={createForm.dimensions}
                    onChange={(e) => setCreateForm({ ...createForm, dimensions: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="e.g., 30x20x15 cm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.shipping_cost}
                    onChange={(e) => setCreateForm({ ...createForm, shipping_cost: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery</label>
                  <input
                    type="date"
                    value={createForm.estimated_delivery}
                    onChange={(e) => setCreateForm({ ...createForm, estimated_delivery: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Any special instructions..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipment Detail Modal */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedShipment.shipment_number}</h2>
                <p className="text-gray-600">Order: {selectedShipment.order_number}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status */}
            <div className="mb-6">
              <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[selectedShipment.status] || 'bg-gray-100'}`}>
                {STATUS_LABELS[selectedShipment.status] || selectedShipment.status}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Courier</p>
                <p className="font-medium">{selectedShipment.courier_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tracking Number</p>
                {selectedShipment.tracking_number ? (
                  selectedShipment.tracking_url ? (
                    <a
                      href={selectedShipment.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {selectedShipment.tracking_number} ↗
                    </a>
                  ) : (
                    <p className="font-medium font-mono">{selectedShipment.tracking_number}</p>
                  )
                ) : (
                  <p className="text-gray-400">Not assigned</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{selectedShipment.customer_name}</p>
                <p className="text-sm text-gray-500">{selectedShipment.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Total</p>
                <p className="font-medium">${selectedShipment.order_total?.toFixed(2)}</p>
              </div>
              {selectedShipment.estimated_delivery && (
                <div>
                  <p className="text-sm text-gray-600">Estimated Delivery</p>
                  <p className="font-medium">{formatDate(selectedShipment.estimated_delivery)}</p>
                </div>
              )}
              {selectedShipment.actual_delivery && (
                <div>
                  <p className="text-sm text-gray-600">Delivered At</p>
                  <p className="font-medium text-green-600">{formatDate(selectedShipment.actual_delivery)}</p>
                </div>
              )}
            </div>

            {/* Update Status Form */}
            {selectedShipment.available_transitions && selectedShipment.available_transitions.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-3">Update Status</h3>
                <form onSubmit={handleUpdateStatus} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={updateForm.new_status}
                      onChange={(e) => setUpdateForm({ ...updateForm, new_status: e.target.value })}
                      required
                      className="border rounded-lg px-3 py-2"
                    >
                      <option value="">Select new status</option>
                      {selectedShipment.available_transitions.map((t) => (
                        <option key={t.status} value={t.status}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Location (optional)"
                      value={updateForm.location}
                      onChange={(e) => setUpdateForm({ ...updateForm, location: e.target.value })}
                      className="border rounded-lg px-3 py-2"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={updateForm.description}
                    onChange={(e) => setUpdateForm({ ...updateForm, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update Status
                  </button>
                </form>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="font-medium mb-3">Tracking Timeline</h3>
              {selectedShipment.timeline && selectedShipment.timeline.length > 0 ? (
                <div className="space-y-3">
                  {selectedShipment.timeline.map((event, index) => (
                    <div key={event.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        {index < selectedShipment.timeline!.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[event.status] || 'bg-gray-100'}`}>
                              {STATUS_LABELS[event.status] || event.status}
                            </span>
                            <p className="text-sm mt-1">{event.description}</p>
                            {event.location && (
                              <p className="text-xs text-gray-500 mt-0.5">📍 {event.location}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{formatDate(event.event_time)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No tracking events yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
