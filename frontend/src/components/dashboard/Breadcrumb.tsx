import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { TAB_DEFINITIONS } from './DashboardSidebar';

interface BreadcrumbProps {
  symbol?: string;
}

export default function Breadcrumb({ symbol }: BreadcrumbProps) {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const items: { label: string; href?: string }[] = [
      { label: 'Home', href: '/' },
    ];

    if (!symbol) return items;

    items.push({ label: `Gene: ${symbol}`, href: `/gene/${symbol}` });

    // Find active tab
    const base = `/gene/${symbol}`;
    for (const tab of TAB_DEFINITIONS) {
      if (tab.path && location.pathname === `${base}${tab.path}`) {
        items.push({ label: tab.label });
        break;
      }
    }

    return items;
  }, [symbol, location.pathname]);

  return (
    <div
      className="hidden md:block border-b border-cyan/[0.04] px-6"
      style={{
        height: '36px',
        background: 'rgba(10, 14, 26, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="max-w-[1600px] mx-auto h-full flex items-center gap-1.5">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-text-muted/40" />}
            {crumb.href && i < crumbs.length - 1 ? (
              <Link
                to={crumb.href}
                className="text-xs font-body text-text-muted hover:text-cyan transition-colors flex items-center gap-1"
              >
                {i === 0 && <Home className="w-3 h-3" />}
                {crumb.label}
              </Link>
            ) : (
              <span className={`text-xs font-body ${i === crumbs.length - 1 ? 'text-text-primary' : 'text-text-muted'}`}>
                {i === 0 && <Home className="w-3 h-3 inline mr-1" />}
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
