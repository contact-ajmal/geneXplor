import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DNAHelix from './components/ui/DNAHelix';
import ParticleField from './components/ui/ParticleField';
import ToastContainer from './components/ui/Toast';
import type { ToastMessage } from './components/ui/Toast';
import HomePage from './pages/HomePage';

const GeneDashboardPage = lazy(() => import('./pages/GeneDashboardPage'));
const GeneStoryPage = lazy(() => import('./pages/GeneStoryPage'));
const TrendingPage = lazy(() => import('./pages/TrendingPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const CompareResultPage = lazy(() => import('./pages/CompareResultPage'));

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
    // Apply theme class to html element so body background updates
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
        {/* Background layers — hidden in light mode */}
        {darkMode && (
          <>
            <DNAHelix opacity={0.1} />
            <ParticleField />
          </>
        )}

        {/* App shell */}
        <Navbar darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

        <main className="flex-1 relative z-10 pt-14">
          <Suspense fallback={<DashboardFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/gene/:symbol" element={<GeneDashboardPage />} />
              <Route path="/gene/:symbol/story" element={<GeneStoryPage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/compare/:symbolA/:symbolB" element={<CompareResultPage />} />
            </Routes>
          </Suspense>
        </main>

        <Footer />

        {/* Toast notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </BrowserRouter>
  );
}
