import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/Navbar'
import api from '../../api/axios'
import {
  UserGroupIcon, UsersIcon, BookOpenIcon, ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'

function StatCard({ label, value, icon: Icon, to, color }) {
  const colorMap = {
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    purple:'bg-purple-50 text-purple-700',
    orange:'bg-orange-50 text-orange-700',
  }
  return (
    <Link to={to} className="card hover:shadow-md transition-shadow flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</div>
        <div className="text-sm text-slate-500 dark:text-slate-300">{label}</div>
      </div>
    </Link>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()

  const { data: students }    = useQuery({ queryKey: ['admin-students'],    queryFn: () => api.get('/admin/students').then(r => r.data) })
  const { data: teachers }    = useQuery({ queryKey: ['admin-teachers'],    queryFn: () => api.get('/admin/teachers').then(r => r.data) })
  const { data: subjects }    = useQuery({ queryKey: ['admin-subjects'],    queryFn: () => api.get('/admin/subjects').then(r => r.data) })
  const { data: assessments } = useQuery({ queryKey: ['admin-assessments'], queryFn: () => api.get('/admin/assessments').then(r => r.data) })

  const now    = new Date()
  const hour   = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-sm mt-1">
            {now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>

        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Overview</h2>
        <div className="grid grid-cols-1  sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Students"    value={students?.length}    icon={UserGroupIcon}              to="/admin/students"    color="blue" />
          <StatCard label="Total Teachers"    value={teachers?.length}    icon={UsersIcon}                   to="/admin/teachers"    color="green" />
          <StatCard label="Subjects"          value={subjects?.length}    icon={BookOpenIcon}                to="/admin/subjects"    color="purple" />
          <StatCard label="Assessments"       value={assessments?.length} icon={ClipboardDocumentListIcon}   to="/admin/assessments" color="orange" />
        </div>

        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Results Progress',  to: '/admin/progress',     desc: 'Track submission status by subject/teacher' },
            { label: 'Live Standings',    to: '/admin/standings',    desc: 'View live ranked results as teachers submit' },
            { label: 'Class Analytics',   to: '/admin/analytics',    desc: 'Grade distribution and GPA per subject' },
            { label: 'Generate Report Cards', to: '/admin/reportcards', desc: 'Print PDF booklet for any class' },
            { label: 'Manage Students',   to: '/admin/students',     desc: 'Add, edit, or bulk import students' },
            { label: 'Assign Teachers',   to: '/admin/assignments',  desc: 'Assign teachers to subjects and classes' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="card hover:shadow-md transition-shadow">
              <div className="font-semibold text-slate-800">{item.label}</div>
              <div className="text-sm text-slate-500 mt-0.5">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
