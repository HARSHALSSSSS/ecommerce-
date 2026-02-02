import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Store,
  Settings,
  X,
  ShoppingBag,
  Shield,
  UserCog,
  Activity,
  MonitorSmartphone,
  FolderTree,
  Boxes,
  Truck,
  RotateCcw,
  DollarSign,
  RefreshCw,
  MessageSquare,
  CreditCard,
  FileText,
  Bell,
  FileCode,
  Zap,
  Megaphone,
  BarChart2,
  FileSearch,
  ToggleRight,
  Sparkles,
  Image,
  CheckSquare,
} from 'lucide-react'
import clsx from 'clsx'

interface SidebarProps {
  isOpen: boolean
  isMobileOpen: boolean
  onClose: () => void
}

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Catalog Management' },
  { path: '/categories', label: 'Categories', icon: FolderTree },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/inventory', label: 'Inventory', icon: Boxes },
  { section: 'Orders & Fulfillment' },
  { path: '/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/shipments', label: 'Shipments', icon: Truck },
  { path: '/returns', label: 'Returns', icon: RotateCcw },
  { path: '/refunds', label: 'Refunds', icon: DollarSign },
  { path: '/replacements', label: 'Replacements', icon: RefreshCw },
  { section: 'Payments & Invoicing' },
  { path: '/payments', label: 'Payment Logs', icon: CreditCard },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { section: 'Support & Communication' },
  { path: '/tickets', label: 'Tickets', icon: MessageSquare },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/notification-templates', label: 'Templates', icon: FileCode },
  { path: '/event-rules', label: 'Event Rules', icon: Zap },
  { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { section: 'AI Features' },
  { path: '/ai/image-generator', label: 'Image Generator', icon: Image },
  { path: '/ai/description-generator', label: 'Description Gen', icon: FileText },
  { path: '/ai/approval-queue', label: 'Approval Queue', icon: CheckSquare },
  { path: '/ai/usage-dashboard', label: 'AI Analytics', icon: Sparkles },
  { section: 'Customers' },
  { path: '/users', label: 'Customers', icon: Users },
  { path: '/stores', label: 'Stores', icon: Store },
  { section: 'Admin Management' },
  { path: '/roles', label: 'Roles & Access', icon: Shield },
  { path: '/admin-users', label: 'Admin Users', icon: UserCog },
  { path: '/sessions', label: 'Sessions', icon: MonitorSmartphone },
  { path: '/activity-logs', label: 'Activity Logs', icon: Activity },
  { section: 'Reports & System' },
  { path: '/reports', label: 'Reports', icon: BarChart2 },
  { path: '/audit-logs', label: 'Audit Logs', icon: FileSearch },
  { path: '/feature-toggles', label: 'Feature Toggles', icon: ToggleRight },
  { section: 'divider' },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ isOpen, isMobileOpen, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-30 h-full bg-white shadow-lg transition-all duration-300 hidden lg:flex flex-col overflow-y-auto border-r border-gray-200',
          isOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            {isOpen && (
              <span className="font-bold text-lg text-gray-900">EcomAdmin</span>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            if ('section' in item) {
              if (item.section === 'divider') {
                return <div key={index} className="my-3 border-t border-gray-200" />
              }
              return isOpen ? (
                <div key={index} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
                  {item.section}
                </div>
              ) : (
                <div key={index} className="my-3 border-t border-gray-200" />
              )
            }

            const isActive = location.pathname === item.path
            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path!}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/30 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 font-medium',
                  !isOpen && 'justify-center'
                )}
                title={!isOpen ? item.label : undefined}
              >
                {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                {isOpen && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 h-full w-64 bg-white shadow-2xl transition-transform duration-300 lg:hidden flex flex-col overflow-y-auto border-r border-gray-200',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">EcomAdmin</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex-shrink-0"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            if ('section' in item) {
              if (item.section === 'divider') {
                return <div key={index} className="my-3 border-t border-gray-200" />
              }
              return (
                <div key={index} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
                  {item.section}
                </div>
              )
            }

            const isActive = location.pathname === item.path
            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium',
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/30 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
