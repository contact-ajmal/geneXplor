import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useLocation, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Dna, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchGene, fetchGeneSummary } from '../../lib/api';
import type { GeneDashboardResponse, GeneSummaryResponse } from '../../lib/api';
import DashboardGeneHeader from './DashboardGeneHeader';
import DashboardSidebar from './DashboardSidebar';
import MobileTabBar from './MobileTabBar';
import Breadcrumb from './Breadcrumb';
import AnimatedButton from '../ui/AnimatedButton';
import ToastContainer from '../ui/Toast';
import type { ToastMessage } from '../ui/Toast';
import LoadingPage from '../../pages/LoadingPage';

export interface DashboardOutletContext {
  data: GeneDashboardResponse;
  symbol: string;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function DashboardLayout() {
  const { symbol } = useParams<{ symbol: string }>();
  const location = useLocation();
  const upperSymbol = symbol?.toUpperCase() || '';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = String(++toastIdRef.current);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const { data, isLoading, error, refetch } = useQuery<GeneDashboardResponse, Error>({
    queryKey: ['gene', upperSymbol],
    queryFn: () => fetchGene(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  const { data: summaryData } = useQuery<GeneSummaryResponse>({
    queryKey: ['gene-summary', upperSymbol],
    queryFn: () => fetchGeneSummary(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  // Compute badge counts
  const badges = useMemo(() => {
    if (!data) return {};
    return {
      variants: data.variants?.variants.length || 0,
      conflicts: data.reconciliation?.summary?.conflicts_found || 0,
      highConflicts: data.reconciliation?.conflicts?.filter(c => c.severity === 'HIGH').length || 0,
      interactions: data.interactions?.interactions?.length || 0,
      publications: data.publications?.total_results || 0,
      diseases: data.variants?.diseases.length || 0,
    };
  }, [data]);

  // Loading
  if (isLoading) {
    return <LoadingPage symbol={upperSymbol} />;
  }

  // Error
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <Dna className="w-20 h-20 text-magenta/40" />
          </div>
          <div className="p-6 rounded-2xl bg-magenta/5 border border-magenta/20 mb-6">
            <AlertCircle className="w-6 h-6 text-magenta mx-auto mb-3" />
            <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">Gene not found</h2>
            <p className="text-text-secondary text-sm font-body mb-4">
              Gene &lsquo;<span className="font-mono text-cyan">{upperSymbol}</span>&rsquo; was not found.
              Try searching for <span className="font-mono text-cyan">TP53</span>,{' '}
              <span className="font-mono text-cyan">BRCA1</span>, or{' '}
              <span className="font-mono text-cyan">EGFR</span>.
            </p>
            <p className="text-text-muted text-xs font-body">{error.message}</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link to="/">
              <AnimatedButton variant="primary">
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Back to search
                </span>
              </AnimatedButton>
            </Link>
            <AnimatedButton variant="secondary" onClick={() => refetch()}>
              Retry
            </AnimatedButton>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data || !data.gene) return null;

  const outletContext: DashboardOutletContext = {
    data,
    symbol: upperSymbol,
    showToast,
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Breadcrumb */}
      <Breadcrumb symbol={upperSymbol} />

      {/* Persistent Gene Header */}
      <DashboardGeneHeader
        gene={data.gene}
        metadata={data.metadata}
        aiSummary={summaryData?.summary}
        onToast={showToast}
      />

      {/* Mobile Tab Bar */}
      <MobileTabBar symbol={upperSymbol} badges={badges} />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <DashboardSidebar
          symbol={upperSymbol}
          collapsed={sidebarCollapsed}
          badges={badges}
        />

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 md:p-6 max-w-[1400px] mx-auto"
            >
              <Outlet context={outletContext} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
