import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Ticket {
  id: number;
  ticket_number: string;
  user_id: number;
  order_id?: number;
  subject: string;
  description: string;
  category: string;
  category_label: string;
  priority: string;
  priority_label: string;
  priority_color: string;
  status: string;
  status_label: string;
  status_color: string;
  sla_hours: number;
  sla_due_at: string;
  sla_breached: boolean;
  is_sla_breached: boolean;
  sla_remaining: number;
  assigned_to?: number;
  assigned_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  order_number?: string;
  escalation_level: number;
  first_response_at?: string;
  resolution_summary?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_type: 'user' | 'admin';
  sender_id: number;
  sender_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

interface TicketStats {
  total_tickets: number;
  open_tickets: number;
  in_progress: number;
  awaiting_customer: number;
  escalated: number;
  resolved: number;
  closed: number;
  unassigned: number;
  sla_breached: number;
  sla_at_risk: number;
  today: {
    created_today: number;
    closed_today: number;
  };
  by_priority: { priority: string; priority_label: string; priority_color: string; count: number }[];
  by_category: { category: string; category_label: string; count: number }[];
  avg_resolution_hours: number | null;
  avg_first_response_hours: number | null;
}

interface Agent {
  id: number;
  email: string;
  role: string;
  open_tickets: number;
}

const Tickets: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Form states
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [closeStatus, setCloseStatus] = useState<'resolved' | 'closed'>('resolved');
  const [activeTab, setActiveTab] = useState<'all' | 'escalated'>('all');

  const categories = [
    { code: 'general', label: 'General Inquiry' },
    { code: 'order', label: 'Order Issue' },
    { code: 'payment', label: 'Payment Issue' },
    { code: 'delivery', label: 'Delivery Problem' },
    { code: 'product', label: 'Product Quality' },
    { code: 'refund', label: 'Refund Request' },
    { code: 'return', label: 'Return Issue' },
    { code: 'account', label: 'Account Issue' },
    { code: 'technical', label: 'Technical Support' },
    { code: 'feedback', label: 'Feedback/Suggestion' },
    { code: 'other', label: 'Other' },
  ];

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter, categoryFilter, slaFilter, searchQuery, currentPage, activeTab]);

  const fetchData = async () => {
    try {
      const [ticketsRes, statsRes, agentsRes] = await Promise.all([
        activeTab === 'escalated' 
          ? api.get('/tickets/admin/escalated', { params: { page: currentPage, limit: 20 } })
          : api.get('/tickets/admin', {
              params: {
                status: statusFilter,
                priority: priorityFilter,
                category: categoryFilter,
                sla_status: slaFilter,
                search: searchQuery,
                page: currentPage,
                limit: 20,
              },
            }),
        api.get('/tickets/admin/stats'),
        api.get('/tickets/admin/agents'),
      ]);

      setTickets(ticketsRes.data.tickets);
      setStats(statsRes.data.stats);
      setAgents(agentsRes.data.agents);
      setTotalPages(ticketsRes.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching tickets data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetail = async (ticket: Ticket) => {
    try {
      const response = await api.get(`/tickets/admin/${ticket.id}`);
      setSelectedTicket(response.data.ticket);
      setTicketMessages(response.data.ticket.messages || []);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching ticket detail:', error);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    try {
      await api.post(`/tickets/admin/${selectedTicket.id}/reply`, {
        message: replyMessage,
        is_internal: isInternalNote,
      });
      
      setReplyMessage('');
      setIsInternalNote(false);
      fetchTicketDetail(selectedTicket);
      fetchData();
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedTicket) return;
    
    try {
      await api.put(`/tickets/admin/${selectedTicket.id}/assign`, {
        assigned_to: selectedAgent,
      });
      
      setShowAssignModal(false);
      setSelectedAgent(null);
      fetchTicketDetail(selectedTicket);
      fetchData();
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  const handleStatusChange = async (ticketId: number, status: string) => {
    try {
      await api.put(`/tickets/admin/${ticketId}/status`, { status });
      fetchData();
      if (selectedTicket?.id === ticketId) {
        fetchTicketDetail(selectedTicket);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePriorityChange = async (ticketId: number, priority: string) => {
    try {
      await api.put(`/tickets/admin/${ticketId}/priority`, { priority });
      fetchData();
      if (selectedTicket?.id === ticketId) {
        fetchTicketDetail(selectedTicket);
      }
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleEscalate = async () => {
    if (!selectedTicket || !escalationReason.trim()) return;
    
    try {
      await api.put(`/tickets/admin/${selectedTicket.id}/escalate`, {
        reason: escalationReason,
        notes: escalationNotes,
      });
      
      setShowEscalateModal(false);
      setEscalationReason('');
      setEscalationNotes('');
      fetchTicketDetail(selectedTicket);
      fetchData();
    } catch (error) {
      console.error('Error escalating ticket:', error);
    }
  };

  const handleClose = async () => {
    if (!selectedTicket || !resolutionSummary.trim()) return;
    
    try {
      await api.put(`/tickets/admin/${selectedTicket.id}/close`, {
        resolution_summary: resolutionSummary,
        status: closeStatus,
      });
      
      setShowCloseModal(false);
      setResolutionSummary('');
      setShowDetailModal(false);
      fetchData();
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSlaRemaining = (minutes: number) => {
    if (minutes <= 0) return 'Breached';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  };

  const getSlaIndicator = (ticket: Ticket) => {
    if (ticket.is_sla_breached) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">⚠️ SLA Breached</span>;
    }
    if (ticket.sla_remaining < 240) { // Less than 4 hours
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏰ {formatSlaRemaining(ticket.sla_remaining)}</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ {formatSlaRemaining(ticket.sla_remaining)}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ticket Management</h1>
        <p className="text-gray-600">Manage customer support tickets and grievances</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-3">
            <div className="text-xl md:text-2xl font-bold text-gray-900">{stats.total_tickets}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-3 border-l-4 border-blue-500">
            <div className="text-xl md:text-2xl font-bold text-blue-700">{stats.open_tickets}</div>
            <div className="text-xs text-blue-600">Open</div>
          </div>
          <div className="bg-purple-50 rounded-lg shadow p-3 border-l-4 border-purple-500">
            <div className="text-xl md:text-2xl font-bold text-purple-700">{stats.in_progress}</div>
            <div className="text-xs text-purple-600">In Progress</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-3 border-l-4 border-yellow-500">
            <div className="text-xl md:text-2xl font-bold text-yellow-700">{stats.awaiting_customer}</div>
            <div className="text-xs text-yellow-600">Awaiting</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-3 border-l-4 border-red-500">
            <div className="text-xl md:text-2xl font-bold text-red-700">{stats.escalated}</div>
            <div className="text-xs text-red-600">Escalated</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-3 border-l-4 border-green-500">
            <div className="text-xl md:text-2xl font-bold text-green-700">{stats.resolved}</div>
            <div className="text-xs text-green-600">Resolved</div>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-3 border-l-4 border-gray-500">
            <div className="text-xl md:text-2xl font-bold text-gray-700">{stats.unassigned}</div>
            <div className="text-xs text-gray-600">Unassigned</div>
          </div>
          <div className="bg-red-100 rounded-lg shadow p-3 border-l-4 border-red-700">
            <div className="text-xl md:text-2xl font-bold text-red-800">{stats.sla_breached}</div>
            <div className="text-xs text-red-700">SLA Breached</div>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-3 border-l-4 border-orange-500">
            <div className="text-xl md:text-2xl font-bold text-orange-700">{stats.sla_at_risk}</div>
            <div className="text-xs text-orange-600">At Risk</div>
          </div>
          <div className="bg-indigo-50 rounded-lg shadow p-3 border-l-4 border-indigo-500">
            <div className="text-xl md:text-2xl font-bold text-indigo-700">{stats.today?.created_today || 0}</div>
            <div className="text-xs text-indigo-600">Today</div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg First Response</h3>
            <div className="text-xl font-bold text-gray-900">
              {stats.avg_first_response_hours && stats.avg_first_response_hours > 0 
                ? `${(stats.avg_first_response_hours).toFixed(1)} hours` 
                : 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Resolution Time</h3>
            <div className="text-xl font-bold text-gray-900">
              {stats.avg_resolution_hours && stats.avg_resolution_hours > 0 
                ? `${(stats.avg_resolution_hours).toFixed(1)} hours` 
                : 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Tickets Closed Today</h3>
            <div className="text-xl font-bold text-gray-900">{stats.today?.closed_today || 0}</div>
          </div>
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-6 py-3 text-sm font-medium ${activeTab === 'all' 
                ? 'border-b-2 border-indigo-500 text-indigo-600' 
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              All Tickets
            </button>
            <button
              onClick={() => { setActiveTab('escalated'); setCurrentPage(1); }}
              className={`px-6 py-3 text-sm font-medium ${activeTab === 'escalated' 
                ? 'border-b-2 border-red-500 text-red-600' 
                : 'text-gray-500 hover:text-gray-700'}`}
            >
              Escalated ({stats?.escalated || 0})
            </button>
          </nav>
        </div>

        {activeTab === 'all' && (
          <div className="p-4 flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="awaiting_customer">Awaiting Customer</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.code} value={cat.code}>{cat.label}</option>
              ))}
            </select>
            <select
              value={slaFilter}
              onChange={(e) => { setSlaFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="all">All SLA</option>
              <option value="breached">SLA Breached</option>
              <option value="at_risk">At Risk</option>
            </select>
          </div>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Ticket</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">SLA</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Assigned</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No tickets found
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className={`hover:bg-gray-50 ${ticket.is_sla_breached ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">{ticket.ticket_number}</div>
                    <div className="text-sm text-gray-500 truncate max-w-[200px]">{ticket.subject}</div>
                    {ticket.order_number && (
                      <div className="text-xs text-indigo-600">Order: {ticket.order_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">{ticket.customer_name}</div>
                    <div className="text-xs text-gray-500">{ticket.customer_email}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-700">{ticket.category_label}</span>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={ticket.priority}
                      onChange={(e) => handlePriorityChange(ticket.id, e.target.value)}
                      className="text-xs rounded px-2 py-1 border-0"
                      style={{ backgroundColor: `${ticket.priority_color}20`, color: ticket.priority_color }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      className="text-xs rounded px-2 py-1 border-0"
                      style={{ backgroundColor: `${ticket.status_color}20`, color: ticket.status_color }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="awaiting_customer">Awaiting Customer</option>
                      <option value="awaiting_internal">Awaiting Internal</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    {getSlaIndicator(ticket)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-700">
                      {ticket.assigned_name || <span className="text-gray-400 italic">Unassigned</span>}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(ticket.created_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => fetchTicketDetail(ticket)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-3 py-1 bg-indigo-50 rounded hover:bg-indigo-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedTicket.ticket_number}</h2>
                <p className="text-lg text-gray-700 mt-1">{selectedTicket.subject}</p>
                <div className="flex gap-2 mt-2">
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: `${selectedTicket.priority_color}20`, color: selectedTicket.priority_color }}
                  >
                    {selectedTicket.priority_label}
                  </span>
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: `${selectedTicket.status_color}20`, color: selectedTicket.status_color }}
                  >
                    {selectedTicket.status_label}
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {selectedTicket.category_label}
                  </span>
                  {selectedTicket.escalation_level > 0 && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                      Level {selectedTicket.escalation_level} Escalation
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Customer Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Customer</h3>
                  <p className="font-medium text-gray-900">{selectedTicket.customer_name}</p>
                  <p className="text-sm text-gray-600">{selectedTicket.customer_email}</p>
                  {selectedTicket.customer_phone && (
                    <p className="text-sm text-gray-600">{selectedTicket.customer_phone}</p>
                  )}
                </div>
                {/* Order Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Related Order</h3>
                  {selectedTicket.order_number ? (
                    <>
                      <p className="font-medium text-gray-900">{selectedTicket.order_number}</p>
                      <p className="text-sm text-gray-600">${(selectedTicket as any).order_total?.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="text-gray-400 italic">No order linked</p>
                  )}
                </div>
                {/* SLA Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">SLA Status</h3>
                  {getSlaIndicator(selectedTicket)}
                  <p className="text-xs text-gray-500 mt-2">Due: {formatDate(selectedTicket.sla_due_at)}</p>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Conversation</h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto bg-gray-50 p-4 rounded-lg">
                  {ticketMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-lg ${
                        msg.sender_type === 'admin'
                          ? msg.is_internal
                            ? 'bg-yellow-50 border border-yellow-200 ml-8'
                            : 'bg-indigo-50 border border-indigo-200 ml-8'
                          : 'bg-white border border-gray-200 mr-8'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${
                            msg.sender_type === 'admin' ? 'text-indigo-700' : 'text-gray-700'
                          }`}>
                            {msg.sender_name}
                          </span>
                          {msg.is_internal && (
                            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">
                              Internal Note
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {msg.sender_type === 'admin' ? '(Support)' : '(Customer)'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reply Form */}
              {!['resolved', 'closed'].includes(selectedTicket.status) && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Reply</h3>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-600">Internal note (not visible to customer)</span>
                    </label>
                    <button
                      onClick={handleReply}
                      disabled={!replyMessage.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-gray-50 flex justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Assign
                </button>
                {!['resolved', 'closed'].includes(selectedTicket.status) && (
                  <button
                    onClick={() => setShowEscalateModal(true)}
                    className="px-4 py-2 bg-red-100 border border-red-300 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Escalate
                  </button>
                )}
              </div>
              {!['resolved', 'closed'].includes(selectedTicket.status) && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Resolve/Close Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Assign Ticket</h2>
            <p className="text-gray-600 mb-4">Select an agent to assign this ticket to:</p>
            
            <select
              value={selectedAgent || ''}
              onChange={(e) => setSelectedAgent(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
            >
              <option value="">Unassigned</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.email} ({agent.open_tickets} open tickets)
                </option>
              ))}
            </select>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowAssignModal(false); setSelectedAgent(null); }}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Escalate Ticket</h2>
            <p className="text-gray-600 mb-4">
              Current Level: {selectedTicket.escalation_level || 0} → New Level: {(selectedTicket.escalation_level || 0) + 1}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Escalation *
              </label>
              <input
                type="text"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="e.g., Customer threatening legal action"
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={escalationNotes}
                onChange={(e) => setEscalationNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowEscalateModal(false); setEscalationReason(''); setEscalationNotes(''); }}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={!escalationReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Close Ticket</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Close Status
              </label>
              <select
                value={closeStatus}
                onChange={(e) => setCloseStatus(e.target.value as 'resolved' | 'closed')}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="resolved">Resolved (Issue was fixed)</option>
                <option value="closed">Closed (No further action)</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Summary *
              </label>
              <textarea
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCloseModal(false); setResolutionSummary(''); }}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={!resolutionSummary.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
