import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import LoginPage from './page/Authentication/Login/LoginPage.jsx'
import HomePage from './page/Home/HomePage.jsx'
import GuideDetailPage from './page/Guide/GuideDetailPage.jsx'
import CityGuidePage from './page/Hot-Guide/CityGuidePage.jsx'
import { AuthProvider, useAuth } from './page/Authentication/AuthContext.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" /> : children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<HomePage />} />
          <Route path="/city/:city/guide" element={<CityGuidePage />} />
          <Route path="/u/:username/guide/:guideSlug" element={<GuideDetailPage />} />{/* temporary route */}
          <Route path="/planner" element={<PrivateRoute><App /></PrivateRoute>} />
          <Route path="/planner/:uuid" element={<PrivateRoute><App /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
