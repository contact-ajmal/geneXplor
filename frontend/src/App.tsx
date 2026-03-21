import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DNAHelix from './components/ui/DNAHelix';
import ParticleField from './components/ui/ParticleField';
import ToastContainer from './components/ui/Toast';
import type { ToastMessage } from './components/ui/Toast';
import HomePage from './pages/HomePage';

const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
const OverviewTab = lazy(() => import('./pages/tabs/OverviewTab'));
const ProteinTab = lazy(() => import('./pages/tabs/ProteinTab'));
const VariantsTab = lazy(() => import('./pages/tabs/VariantsTab'));
const PopulationTab = lazy(() => import('./pages/tabs/PopulationTab'));
const ReconciliationTab = lazy(() => import('./pages/tabs/ReconciliationTab'));
const TimelineTab = lazy(() => import('./pages/tabs/TimelineTab'));
const InteractionsTab = lazy(() => import('./pages/tabs/InteractionsTab'));
const PathwaysTab = lazy(() => import('./pages/tabs/PathwaysTab'));
const PublicationsTab = lazy(() => import('./pages/tabs/PublicationsTab'));
const DiseasesTab = lazy(() => import('./pages/tabs/DiseasesTab'));
const SimulatorTab = lazy(() => import('./pages/tabs/SimulatorTab'));
const ReportTab = lazy(() => import('./pages/tabs/ReportTab'));
const GeneStoryPage = lazy(() => import('./pages/GeneStoryPage'));
const TrendingPage = lazy(() => import('./pages/TrendingPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const CompareResultPage = lazy(() => import('./pages/CompareResultPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));

function DashboardFallback() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      <div className="space-y-4">
        <div className="h-10 w-40 rounded skeleton-shimmer" />
        <div className="h-5 w-80 rounded skeleton-shimmer" />
        <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
          <div className="h-5 w-1/3 rounded skeleton-shimmer mb-4" />
          <div className="space-y-3">
            {[85, 70, 55, 40].map((w, i) => (
              <div key={i} className="h-3.5 rounded skeleton-shimmer" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionalFooter() {
  const location = useLocation();
  // Hide footer on gene dashboard pages (they have their own full-height layout)
  if (location.pathname.match(/^\/gene\/[^/]+(\/|$)/) && !location.pathname.endsWith('/story')) {
    return null;
  }
  return <Footer />;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('genexplor_theme');
      return stored ? stored === 'dark' : true;
    } catch {
      return true;
    }
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('genexplor_theme', darkMode ? 'dark' : 'light');
    } catch { /* ignore */ }
    if (darkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [darkMode]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <BrowserRouter>
      <div className={`noise-overlay min-h-screen flex flex-col ${darkMode ? 'dark' : 'light'}`}>
        {darkMode && (
          <>
            <DNAHelix opacity={0.1} />
            <ParticleField />
          </>
        )}

        <Navbar darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

        <main className="flex-1 relative z-10 pt-14 flex flex-col min-h-0">
          <Suspense fallback={<DashboardFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />

              {/* Gene Dashboard with tab routing */}
              <Route path="/gene/:symbol" element={<DashboardLayout />}>
                <Route index element={<OverviewTab />} />
                <Route path="protein" element={<ProteinTab />} />
                <Route path="variants" element={<VariantsTab />} />
                <Route path="population" element={<PopulationTab />} />
                <Route path="reconciliation" element={<ReconciliationTab />} />
                <Route path="timeline" element={<TimelineTab />} />
                <Route path="interactions" element={<InteractionsTab />} />
                <Route path="pathways" element={<PathwaysTab />} />
                <Route path="publications" element={<PublicationsTab />} />
                <Route path="diseases" element={<DiseasesTab />} />
                <Route path="simulator" element={<SimulatorTab />} />
                <Route path="report" element={<ReportTab />} />
              </Route>

              <Route path="/gene/:symbol/story" element={<GeneStoryPage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/compare/:symbolA/:symbolB" element={<CompareResultPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/search" element={<SearchResultsPage />} />
            </Routes>
          </Suspense>
        </main>

        <ConditionalFooter />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </BrowserRouter>
  );
}
