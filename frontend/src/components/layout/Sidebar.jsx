import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import {
  HomeIcon, ClipboardDocumentListIcon, UserGroupIcon,
  AcademicCapIcon, ChartBarIcon, DocumentTextIcon,
  UsersIcon, BookOpenIcon, Bars3Icon, XMarkIcon,
  ArrowRightOnRectangleIcon, UserCircleIcon, LinkIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'

const teacherNav = [
  { label: 'Dashboard',        to: '/teacher/dashboard', icon: HomeIcon },
  { divider: true },
  { label: 'Account Settings', to: '/account',           icon: UserCircleIcon },
]

const adminNav = [
  { label: 'Overview',          to: '/admin/dashboard',   icon: HomeIcon },
  { label: 'Results Progress',  to: '/admin/progress',    icon: ChartBarIcon },
  { label: 'Live Standings',    to: '/admin/standings',   icon: ClipboardDocumentListIcon },
  { label: 'Class Analytics',   to: '/admin/analytics',   icon: ChartBarIcon },
  { label: 'Report Cards',      to: '/admin/reportcards', icon: DocumentTextIcon },
  { divider: true },
  { label: 'Manage Assessments',to: '/admin/assessments', icon: AcademicCapIcon },
  { label: 'Manage Students',   to: '/admin/students',    icon: UserGroupIcon },
  { label: 'Manage Teachers',   to: '/admin/teachers',    icon: UsersIcon },
  { label: 'Manage Subjects',   to: '/admin/subjects',    icon: BookOpenIcon },
  { label: 'Assign Teachers',   to: '/admin/assignments', icon: LinkIcon },
  { divider: true },
  { label: 'Account Settings',  to: '/account',           icon: UserCircleIcon },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = user?.role === 'admin' ? adminNav : teacherNav

  const NavLink = ({ item, mobile = false }) => {
    if (item.divider) return <div className="my-2 border-t border-slate-100 dark:border-slate-700" />
    const active = location.pathname === item.to
    if (collapsed && !mobile) {
      return (
        <Link to={item.to} title={item.label} onClick={() => setMobileOpen(false)}
          className={clsx('flex items-center justify-center p-2.5 rounded-xl transition-colors',
            active
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60')}>
          <item.icon className="w-5 h-5" />
        </Link>
      )
    }
    return (
      <Link to={item.to} onClick={() => setMobileOpen(false)}
        className={clsx('flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
          active
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60')}>
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {item.label}
      </Link>
    )
  }

  const DesktopContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={clsx('border-b border-slate-100 dark:border-slate-700 flex items-center', collapsed ? 'p-3 justify-center' : 'p-4 gap-3')}>
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">SN</div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate" style={{ fontFamily: 'Sora, sans-serif' }}>ScholaNexus</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user?.role === 'admin' ? 'Administrator' : 'Teacher'}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 overflow-y-auto space-y-0.5', collapsed ? 'p-1.5' : 'p-3')}>
        {nav.map((item, i) => <NavLink key={i} item={item} />)}
      </nav>

      {/* Collapse toggle */}
      <div className={clsx('border-t border-slate-100 dark:border-slate-700', collapsed ? 'p-1.5' : 'p-3')}>
        <button onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'flex items-center rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-600 dark:hover:text-slate-300 w-full',
            collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2 text-sm'
          )}>
          {collapsed
            ? <ChevronRightIcon className="w-4 h-4" />
            : <><ChevronLeftIcon className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>

      {/* Footer */}
      <div className={clsx('border-t border-slate-100 dark:border-slate-700', collapsed ? 'p-1.5' : 'p-3')}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex-shrink-0 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-xs">
              {user?.full_name?.[0] ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</div>
            </div>
          </div>
        )}
        <button onClick={logout} title={collapsed ? 'Sign Out' : undefined}
          className={clsx(
            'flex items-center w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors',
            collapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2 text-sm'
          )}>
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  )

  const MobileContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">SN</div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>ScholaNexus</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{user?.role === 'admin' ? 'Administrator' : 'Teacher'}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item, i) => <NavLink key={i} item={item} mobile />)}
      </nav>
      <div className="p-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-xs">
            {user?.full_name?.[0] ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</div>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
          <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white rounded-xl shadow-sm border border-slate-100"
        onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Desktop sidebar */}
      <div className={clsx(
        'hidden md:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 z-30 transition-all duration-200 overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <DesktopContent />
      </div>

      {/* Mobile drawer */}
      <div className={clsx(
        'fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 z-50 transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <MobileContent />
      </div>
    </>
  )
}
