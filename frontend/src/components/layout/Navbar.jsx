import { useState } from 'react'
import Sidebar from './Sidebar'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { useDarkMode } from '../../hooks/useDarkMode'

export default function AppLayout({ children }) {
  const [dark, toggleDark] = useDarkMode()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')

  const handleToggle = () => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      {/* Top bar */}
      <div className={`fixed top-0 right-0 h-12 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-end px-4 z-20 transition-all duration-200 left-0 ${collapsed ? 'md:left-16' : 'md:left-64'}`}>
        <button
          onClick={toggleDark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {dark
            ? <SunIcon className="w-5 h-5 text-amber-400" />
            : <MoonIcon className="w-5 h-5" />}
        </button>
      </div>
      <main className={`flex-1 min-w-0 overflow-x-hidden px-4 md:px-8 pb-4 md:pb-8 pt-16 transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {children}
      </main>
    </div>
  )
}
