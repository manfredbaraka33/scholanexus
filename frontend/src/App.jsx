import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AccountSettings from './pages/AccountSettings'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import ScoreSheet from './pages/teacher/ScoreSheet'
import PublishedStandings from './pages/teacher/PublishedStandings'
import AdminDashboard from './pages/admin/AdminDashboard'
import ResultsProgress from './pages/admin/ResultsProgress'
import LiveStandings from './pages/admin/LiveStandings'
import ClassAnalytics from './pages/admin/ClassAnalytics'
import ReportCards from './pages/admin/ReportCards'
import ManageStudents from './pages/admin/ManageStudents'
import ManageTeachers from './pages/admin/ManageTeachers'
import ManageSubjects from './pages/admin/ManageSubjects'
import ManageAssignments from './pages/admin/ManageAssignments'
import ManageAssessments from './pages/admin/ManageAssessments'
import Spinner from './components/ui/Spinner'

function ProtectedRoute({ children, role }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/teacher/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'} replace /> : <Login />} />
      <Route path="/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
      <Route path="/teacher/dashboard" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/scoresheet" element={<ProtectedRoute><ScoreSheet /></ProtectedRoute>} />
      <Route path="/teacher/standings" element={<ProtectedRoute><PublishedStandings /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/progress" element={<ProtectedRoute role="admin"><ResultsProgress /></ProtectedRoute>} />
      <Route path="/admin/standings" element={<ProtectedRoute role="admin"><LiveStandings /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute role="admin"><ClassAnalytics /></ProtectedRoute>} />
      <Route path="/admin/reportcards" element={<ProtectedRoute role="admin"><ReportCards /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute role="admin"><ManageStudents /></ProtectedRoute>} />
      <Route path="/admin/teachers" element={<ProtectedRoute role="admin"><ManageTeachers /></ProtectedRoute>} />
      <Route path="/admin/subjects" element={<ProtectedRoute role="admin"><ManageSubjects /></ProtectedRoute>} />
      <Route path="/admin/assignments" element={<ProtectedRoute role="admin"><ManageAssignments /></ProtectedRoute>} />
      <Route path="/admin/assessments" element={<ProtectedRoute role="admin"><ManageAssessments /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
