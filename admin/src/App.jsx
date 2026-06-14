import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayoutPage } from './pages/AdminLayoutPage.jsx';
import { ArticlesAllPage } from './pages/ArticlesAllPage.jsx';
import { ArticlesNewPage } from './pages/ArticlesNewPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { IncidentsPage } from './pages/IncidentsPage.jsx';
import { OnboardingPage } from './pages/OnboardingPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AdminLayoutPage />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="articles" element={<Navigate to="/articles/all" replace />} />
        <Route path="articles/all" element={<ArticlesAllPage />} />
        <Route path="articles/new" element={<ArticlesNewPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
