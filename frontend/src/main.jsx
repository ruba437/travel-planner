import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './App.css' // 這裡保留基礎 Reset 樣式

// 引入重構後的頁面
import PlannerPage from './page/Planner/PlannerPage.jsx' 
import LoginPage from './page/Authentication/Login/LoginPage.jsx'
import ForgotPasswordPage from './page/Authentication/ForgotPassword/ForgotPasswordPage.jsx'
import ResetPasswordPage from './page/Authentication/ResetPassword/ResetPasswordPage.jsx'
import UserProfileSettingsPage from './page/UserProfile/UserProfileSettingsPage.jsx'
import HomePage from './page/Home/HomePage.jsx'
import FavoritesPage from './page/Favorites/FavoritesPage.jsx'
import GuideDetailPage from './page/Guide/GuideDetailPage.jsx'
import CityGuidePage from './page/HotGuide/CityGuidePage.jsx' 
import { AuthProvider, useAuth } from './page/Authentication/AuthContext.jsx'
import { FavoritesProvider } from './page/Authentication/FavoritesContext.jsx'

// 路由守衛：未登入者重新導向至登入頁
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="az-loading-overlay"><div className="az-spinner" /></div>
  return user ? children : <Navigate to="/login" />
}

// 路由守衛：已登入者訪問登入頁時重新導向至首頁
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" /> : children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <Routes>
            {/* 公開頁面 */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/settings/profile" element={<PrivateRoute><UserProfileSettingsPage /></PrivateRoute>} />
            <Route path="/" element={<HomePage />} />
            <Route path="/saved" element={<PrivateRoute><FavoritesPage /></PrivateRoute>} />
            <Route path="/city/:city/guide" element={<CityGuidePage />} />
            <Route path="/u/:username/guide/:guideSlug" element={<GuideDetailPage />} />
            
            {/* 公開行程 Planner（只讀，無需登入） */}
            <Route path="/guides/:guideSlug/planner" element={<PlannerPage isPublicMode />} />
            
            {/* 行程規劃器 (重構後的進入點，需登入) */}
            <Route path="/planner" element={<PrivateRoute><PlannerPage /></PrivateRoute>} />
            <Route path="/planner/:uuid" element={<PrivateRoute><PlannerPage /></PrivateRoute>} />
            
            {/* 萬用路由：找不到頁面就回首頁 */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)