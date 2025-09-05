/**
 * Source Filtering - Relevante Quellen pro Section auswählen
 * 
 * Reduziert Token-Load durch:
 * - Section-spezifische Quellenauswahl
 * - Begrenzung auf max 8 Quellen pro Section
 * - Fokus auf key_findings statt vollständige Daten
 */

interface Source {
  title: string;
  publisher?: string;
  year?: number;
  url?: string;
  key_findings?: string[];
  content?: string;
  topic?: string;
}

interface SourcesJson {
  sources: Source[];
  [key: string]: any;
}

/**
 * Topic-Keywords pro Section
 */
const SECTION_TOPICS: Record<string, string[]> = {
  market: [
    'TAM', 'SAM', 'SOM', 'market size', 'growth rate', 'segments', 
    'addressable market', 'market research', 'demographics', 'trends'
  ],
  
  gtm: [
    'CAC', 'channel', 'conversion', 'pricing', 'WTP', 'willingness to pay',
    'sales funnel', 'acquisition', 'marketing', 'partnerships', 'referrals',
    'go-to-market', 'distribution', 'sales strategy'
  ],
  
  business_model: [
    'ARPU', 'revenue', 'pricing model', 'subscription', 'churn', 
    'gross margin', 'unit economics', 'cost structure', 'monetization',
    'business model', 'revenue streams'
  ],
  
  financial_plan: [
    'revenue', 'costs', 'EBITDA', 'burn rate', 'runway', 'valuation',
    'funding', 'financial', 'budget', 'forecast', 'cash flow',
    'P&L', 'profit', 'loss', 'investment', 'ROI'
  ],
  
  competition: [
    'competitor', 'competitive', 'market share', 'positioning',
    'differentiation', 'alternative', 'substitute', 'benchmark'
  ],
  
  problem: [
    'problem', 'pain point', 'challenge', 'issue', 'need', 
    'friction', 'inefficiency', 'gap', 'difficulty'
  ],
  
  solution: [
    'solution', 'product', 'feature', 'benefit', 'value proposition',
    'technology', 'innovation', 'approach', 'method'
  ],
  
  team: [
    'team', 'founder', 'experience', 'expertise', 'background',
    'leadership', 'skills', 'advisory', 'board'
  ]
};

/**
 * Filtert Quellen für eine spezifische Section
 */
export function pickSourcesFor(
  section: string, 
  sourcesJson: SourcesJson, 
  maxSources: number = 8
): SourcesJson {
  if (!sourcesJson.sources || sourcesJson.sources.length === 0) {
    return sourcesJson;
  }

  const topicKeywords = SECTION_TOPICS[section] || [];
  
  if (topicKeywords.length === 0) {
    // Fallback: erste N Quellen
    return {
      ...sourcesJson,
      sources: sourcesJson.sources.slice(0, maxSources).map(cleanSource)
    };
  }

  // Score-basierte Filterung
  const scoredSources = sourcesJson.sources.map(source => {
    let score = 0;
    const searchText = [
      source.title,
      source.topic,
      source.key_findings?.join(' '),
      source.content
    ].filter(Boolean).join(' ').toLowerCase();

    // Score basierend auf Topic-Match
    for (const keyword of topicKeywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += keyword.length > 3 ? 2 : 1; // Längere Keywords mehr Gewicht
      }
    }

    return { source, score };
  });

  // Sortiere nach Score und nimm Top N
  const topSources = scoredSources
    .filter(item => item.score > 0) // Nur relevante Quellen
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map(item => cleanSource(item.source));

  // Falls zu wenige relevante gefunden, fülle mit ersten Quellen auf
  if (topSources.length < Math.min(maxSources / 2, 4)) {
    const remaining = sourcesJson.sources
      .filter(source => !topSources.some(top => top.url === source.url))
      .slice(0, maxSources - topSources.length)
      .map(cleanSource);
    
    topSources.push(...remaining);
  }

  console.log(`🎯 Filtered ${sourcesJson.sources.length} → ${topSources.length} sources for ${section}`);

  return {
    ...sourcesJson,
    sources: topSources
  };
}

/**
 * Bereinigt eine Quelle (nur wichtigste Felder, gekürzte key_findings)
 */
function cleanSource(source: Source): Source {
  return {
    title: source.title,
    publisher: source.publisher,
    year: source.year,
    url: source.url,
    key_findings: source.key_findings?.slice(0, 3), // Max 3 key findings
    topic: source.topic
  };
}

/**
 * Utility: Geschätzte Token-Reduktion durch Filtering
 */
export function estimateTokenSavings(
  originalSources: Source[],
  filteredSources: Source[]
): { originalTokens: number; filteredTokens: number; savings: number } {
  const estimate = (sources: Source[]) => {
    const totalChars = sources.reduce((sum, source) => {
      return sum + JSON.stringify(source).length;
    }, 0);
    return Math.ceil(totalChars / 4); // ~4 chars per token
  };

  const originalTokens = estimate(originalSources);
  const filteredTokens = estimate(filteredSources);
  const savings = originalTokens - filteredTokens;

  return { originalTokens, filteredTokens, savings };
}
