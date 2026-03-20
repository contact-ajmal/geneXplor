import { useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TAB_DEFINITIONS } from './DashboardSidebar';

interface MobileTabBarProps {
  symbol: string;
  badges?: Record<string, number>;
}

export default function MobileTabBar({ symbol, badges = {} }: MobileTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(() => {
    const path = location.pathname;
    const base = `/gene/${symbol}`;
    for (let i = TAB_DEFINITIONS.length - 1; i >= 0; i--) {
      if (TAB_DEFINITIONS[i].path && path === `${base}${TAB_DEFINITIONS[i].path}`) {
        return TAB_DEFINITIONS[i].id;
      }
    }
    return 'overview';
  }, [location.pathname, symbol]);

  // Scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeBtn = scrollRef.current.querySelector(`[data-tab="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  return (
    <div
      className="md:hidden sticky z-30 border-b border-cyan/[0.06] overflow-x-auto scrollbar-hide"
      style={{
        top: '92px', // below nav (56px) + gene header (~36px compact)
        background: 'rgba(10, 14, 26, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div ref={scrollRef} className="flex items-center gap-1 px-2 py-1.5 min-w-max">
        {TAB_DEFINITIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badgeCount = tab.badgeKey ? badges[tab.badgeKey] : undefined;

          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => navigate(`/gene/${symbol}${tab.path}`)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-body
                whitespace-nowrap transition-all cursor-pointer border-none relative shrink-0
                ${isActive
                  ? 'bg-cyan/[0.1] text-cyan'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {badgeCount !== undefined && badgeCount > 0 && (
                <span className="min-w-[16px] h-4 flex items-center justify-center px-0.5
                  rounded-full text-[9px] font-mono font-bold bg-space-600/40 text-text-muted">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
