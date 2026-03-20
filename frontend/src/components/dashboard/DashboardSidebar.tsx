import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, Dna, Microscope, Map as MapIcon, AlertTriangle, Clock,
  Network, Route, BookOpen, Target, Zap, Download,
} from 'lucide-react';

interface TabDef {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  group: string;
  badgeKey?: string;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3, path: '', group: 'OVERVIEW' },
  { id: 'protein', label: 'Protein & Structure', icon: Dna, path: '/protein', group: 'OVERVIEW' },
  { id: 'variants', label: 'Variant Explorer', icon: Microscope, path: '/variants', group: 'VARIANTS', badgeKey: 'variants' },
  { id: 'population', label: 'Population Map', icon: MapIcon, path: '/population', group: 'VARIANTS' },
  { id: 'reconciliation', label: 'Reconciliation', icon: AlertTriangle, path: '/reconciliation', group: 'VARIANTS', badgeKey: 'conflicts' },
  { id: 'timeline', label: 'Discovery Timeline', icon: Clock, path: '/timeline', group: 'VARIANTS' },
  { id: 'interactions', label: 'Interactions', icon: Network, path: '/interactions', group: 'CONTEXT', badgeKey: 'interactions' },
  { id: 'pathways', label: 'Pathways', icon: Route, path: '/pathways', group: 'CONTEXT' },
  { id: 'publications', label: 'Publications', icon: BookOpen, path: '/publications', group: 'CONTEXT', badgeKey: 'publications' },
  { id: 'diseases', label: 'Disease Associations', icon: Target, path: '/diseases', group: 'CONTEXT', badgeKey: 'diseases' },
  { id: 'simulator', label: 'Impact Simulator', icon: Zap, path: '/simulator', group: 'TOOLS' },
  { id: 'report', label: 'Export Reports', icon: Download, path: '/report', group: 'TOOLS' },
];

export { TABS as TAB_DEFINITIONS };
export type { TabDef };

interface DashboardSidebarProps {
  symbol: string;
  collapsed: boolean;
  badges?: Record<string, number>;
}

export default function DashboardSidebar({ symbol, collapsed, badges = {} }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = useMemo(() => {
    const path = location.pathname;
    const base = `/gene/${symbol}`;
    for (let i = TABS.length - 1; i >= 0; i--) {
      if (TABS[i].path && path === `${base}${TABS[i].path}`) {
        return TABS[i].id;
      }
    }
    return 'overview';
  }, [location.pathname, symbol]);

  const groups = useMemo(() => {
    const map = new Map<string, TabDef[]>();
    for (const tab of TABS) {
      if (!map.has(tab.group)) map.set(tab.group, []);
      map.get(tab.group)!.push(tab);
    }
    return map;
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="hidden md:flex flex-col shrink-0 border-r border-cyan/[0.06] h-full overflow-y-auto overflow-x-hidden"
      style={{
        background: 'rgba(15, 22, 40, 0.5)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <nav className="flex-1 py-3 px-2">
        {Array.from(groups).map(([groupName, tabs]) => (
          <div key={groupName} className="mb-3">
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-heading font-semibold text-text-muted/50 uppercase tracking-widest">
                {groupName}
              </p>
            )}
            {collapsed && <div className="h-px bg-space-600/20 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const badgeCount = tab.badgeKey ? badges[tab.badgeKey] : undefined;
                const hasHighSeverity = tab.id === 'reconciliation' && (badges['highConflicts'] || 0) > 0;

                return (
                  <button
                    key={tab.id}
                    onClick={() => navigate(`/gene/${symbol}${tab.path}`)}
                    title={collapsed ? tab.label : undefined}
                    className={`
                      w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 cursor-pointer
                      border-none text-left relative group
                      ${collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2'}
                      ${isActive
                        ? 'bg-cyan/[0.08] text-cyan'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
                      }
                    `}
                    style={isActive ? { borderLeft: '2px solid #00d4ff' } : { borderLeft: '2px solid transparent' }}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan' : ''}`} />
                    {!collapsed && (
                      <>
                        <span className="text-xs font-body truncate flex-1">{tab.label}</span>
                        {badgeCount !== undefined && badgeCount > 0 && (
                          <span className={`
                            min-w-[20px] h-5 flex items-center justify-center px-1
                            rounded-full text-[10px] font-mono font-bold
                            ${hasHighSeverity
                              ? 'bg-magenta/20 text-magenta'
                              : 'bg-space-600/40 text-text-muted'
                            }
                          `}>
                            {badgeCount > 999 ? '999+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badgeCount !== undefined && badgeCount > 0 && (
                      <span className={`
                        absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5
                        flex items-center justify-center px-0.5
                        rounded-full text-[8px] font-mono font-bold
                        ${hasHighSeverity ? 'bg-magenta text-white' : 'bg-space-500 text-text-primary'}
                      `}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 rounded-md
                        bg-space-700 border border-space-500/40 text-xs font-body text-text-primary
                        whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none
                        transition-opacity z-50 shadow-lg">
                        {tab.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </motion.aside>
  );
}
