import { Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import ScenarioPage from './pages/ScenarioPage';
import GenerationPage from './pages/GenerationPage';
import RewardPage from './pages/RewardPage';
import PoolPage from './pages/PoolPage';
import RefinementPage from './pages/RefinementPage';
import { useTheme } from './contexts/ThemeContext';

export default function App() {
  const { isDark } = useTheme();

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <Routes>
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/generation" element={<GenerationPage />} />
          <Route path="/reward" element={<RewardPage />} />
          <Route path="/pool" element={<PoolPage />} />
          <Route path="/refinement" element={<RefinementPage />} />
          <Route path="*" element={<Navigate to="/scenario" replace />} />
        </Routes>
      </div>
    </div>
  );
}
