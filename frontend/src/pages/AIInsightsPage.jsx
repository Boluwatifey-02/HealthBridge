import {
  ArrowLeft,
  BrainCircuit,
  UserRoundCheck,
  CalendarClock,
  FileWarning,
  FileText,
  LogOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import api from '../services/api';
import './AIInsightsPage.css';

const insightIcon = (title = '') => {
  if (title.includes('Reviews due')) return CalendarClock;
  if (title.includes('duplicate')) return UserRoundCheck;
  if (title.includes('Results needing')) return FileText;
  return FileWarning;
};

function AIInsightsPage({ onBack, onLogout }) {
  const [activeInsight, setActiveInsight] = useState('');
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadInsights = async () => {
      try {
        setIsLoading(true);
        setError('');

        const data = await api.getAIInsights();

        if (!isMounted) return;

        if (!Array.isArray(data?.signals)) {
          // A 200 without a signals array is a real problem, not "no data". Say
          // so rather than implying the records are simply empty.
          if (isMounted) {
            setInsights([]);
            setError('The insights service returned an unexpected response. Please try again shortly.');
          }
          return;
        }

        setMethod(data.method);
        setDisclaimer(data.disclaimer);
        setGeneratedAt(data.generatedAt);

        const mappedInsights = data.signals.map((item) => ({
          icon: insightIcon(item.title),
          key: item.key,
          title: item.title,
          description: item.description,
          count: item.count,
          type: item.type,
          items: item.items || [],
        }));

        setInsights(mappedInsights);
        setActiveInsight(mappedInsights[0]?.title || '');
      } catch (loadError) {
        console.error('Unable to fetch AI insights:', loadError);
        if (isMounted) {
          setInsights([]);
          setError(loadError.message || 'Unable to generate AI insights.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInsights();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="ai-insights-page">
      <header className="ai-insights-header">
        <Brand dark />

        <button type="button" className="ai-insights-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>

        {onLogout && (
          <button type="button" className="ai-insights-back" onClick={onLogout}>
            <LogOut size={17} />
            Log out
          </button>
        )}
      </header>

      <main className="ai-insights-main">
        <section className="ai-insights-hero">
          <div>
            <span className="ai-insights-eyebrow">
              <BrainCircuit size={16} />
              Record Insights
            </span>

            <h1>What the records show needs attention</h1>

            <p>
              Each card below is counted directly from the HealthBridge database
              using a fixed rule. {method ? `Method: ${method}.` : ''} Nothing is
              sent to an external service, and none of this is a diagnosis.
            </p>

            {disclaimer && <p className="ai-insights-disclaimer">{disclaimer}</p>}

            {generatedAt && (
              <small className="ai-insights-timestamp">
                Calculated {new Date(generatedAt).toLocaleString('en-GB')}
              </small>
            )}
          </div>
        </section>

        <section className="ai-insights-grid">
          {isLoading && (
            <div className="ai-insights-empty">Counting from the HealthBridge records...</div>
          )}

          {!isLoading && error && (
            <div className="ai-insights-empty">{error}</div>
          )}

          {!isLoading && !error && insights.length === 0 && (
            <div className="ai-insights-empty">
              No signals are available yet. They are calculated from patient
              records, consultations and laboratory requests.
            </div>
          )}

          {insights.map((insight) => {
            const Icon = insight.icon;
            const isOpen = activeInsight === insight.title;

            return (
              <article className="ai-insight-card" key={insight.key || insight.title}>
                <div className="ai-insight-icon">
                  <Icon size={21} />
                </div>

                <div className="ai-insight-content">
                  <span className="ai-insight-count">{insight.count}</span>
                  <h2>{insight.title}</h2>
                  <p>{insight.description}</p>

                  {insight.items.length > 0 && (
                    <button
                      type="button"
                      className="ai-insight-action"
                      onClick={() => setActiveInsight(isOpen ? '' : insight.title)}
                    >
                      {isOpen ? 'Hide the list' : `Show the ${insight.count} affected`}
                    </button>
                  )}

                  {isOpen && insight.items.length > 0 && (
                    <div className="ai-insight-detail">
                      <strong>Records behind this count</strong>
                      <ul>
                        {insight.items.map((item, index) => (
                          <li key={`${insight.key}-${index}`}>
                            <span>{item.label}</span>
                            {item.detail && <em>{item.detail}</em>}
                          </li>
                        ))}
                      </ul>
                      {insight.items.length < insight.count && (
                        <p>
                          Showing the first {insight.items.length} of {insight.count}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default AIInsightsPage;