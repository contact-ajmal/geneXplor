import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ChevronDown } from 'lucide-react';
import type { PubMedArticle } from '../../lib/api';
import GlassCard from '../ui/GlassCard';

interface ResearchPublicationsProps {
  articles: PubMedArticle[];
  totalResults: number;
  delay?: number;
}

export default function ResearchPublications({ articles, totalResults, delay = 0 }: ResearchPublicationsProps) {
  return (
    <GlassCard delay={delay}>
      <div className="mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
          Recent Publications
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          Latest research from PubMed ({totalResults.toLocaleString()} total results)
        </p>
      </div>

      <div className="space-y-3">
        {articles.slice(0, 10).map((article, i) => (
          <PublicationCard key={article.pmid} article={article} index={i} />
        ))}
      </div>
    </GlassCard>
  );
}

function PublicationCard({ article, index }: { article: PubMedArticle; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="p-4 rounded-lg bg-ocean-50 border border-ocean-100 hover:border-primary/30 transition-all group"
    >
      <a
        href={article.pubmed_link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-heading text-sm font-body leading-snug group-hover:text-primary transition-colors font-semibold block"
      >
        {article.title}
        <ExternalLink className="w-3 h-3 inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </a>

      <p className="text-text-muted text-xs mt-1.5 font-body">
        {article.authors}
      </p>
      <p className="text-text-muted text-xs mt-0.5">
        <span className="italic">{article.journal}</span>
        {article.year && <span> ({article.year})</span>}
      </p>

      {article.abstract_snippet && (
        <>
          <p className={`text-text-secondary text-xs mt-2 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {article.abstract_snippet}
          </p>
          {article.abstract_snippet.length > 100 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 mt-1 text-text-muted hover:text-primary text-[10px] font-body transition-colors cursor-pointer"
            >
              {expanded ? 'Less' : 'More'}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
