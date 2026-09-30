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
  if (title.includes('Follow-Up')) return CalendarClock;
  if (title.includes('Duplicate')) return UserRoundCheck;
  if (title.includes('Report')) return FileText;
  return FileWarning;
};

function AIInsightsPage({ onBack, onLogout }) {
  const [activeInsight, setActiveInsight] = useState('');
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadInsights = async () => {
      try {
        setIsLoading(true);
        setError('');

        const data = await api.getAIInsights();

        if (!isMounted) return;

        if (!Array.isArray(data)) {
          // A 200 that is not an insight array is a real problem, not "no data".
          // Say so rather than implying the records are simply empty.
          if (isMounted) {
            setInsights([]);
            setError('The insights service returned an unexpected response. Please try again shortly.');
          }
          return;
        }

        const mappedInsights = data.map((item) => ({
          icon: insightIcon(item.title),
          title: item.title,
          description: item.description,
          count: item.count,
          type: item.type,
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
              AI Health Insights
            </span>

            <h1>Intelligent clinical insights</h1>

            <p>
              Review AI-assisted recommendations and alerts designed to help
              healthcare teams identify important patient information faster.
            </p>
          </div>
        </section>

        <section className="ai-insights-grid">
          {isLoading && (
            <div className="ai-insights-empty">Generating insights from live HealthBridge records...</div>
          )}

          {!isLoading && error && (
            <div className="ai-insights-empty">{error}</div>
          )}

          {!isLoading && !error && insights.length === 0 && (
            <div className="ai-insights-empty">
              No insights are available yet. Insights are generated from patient records,
              consultations and laboratory requests.
            </div>
          )}

          {insights.map((insight) => {
            const Icon = insight.icon;

            return (
              <article className="ai-insight-card" key={insight.title}>
                <div className="ai-insight-icon">
                  <Icon size={21} />
                </div>

                <div className="ai-insight-content">
                  <span className="ai-insight-count">{insight.count}</span>
                  <h2>{insight.title}</h2>
                  <p>{insight.description}</p>

                  <button
                    type="button"
                    className="ai-insight-action"
                    onClick={() =>
                        setActiveInsight(
                          activeInsight === insight.title ? '' : insight.title
                        )
                      }
                  >
                    {activeInsight === insight.title
                      ? 'Hide review'
                      : `Review ${insight.type}`}
                  </button>

                  {activeInsight === insight.title && (
                    <div className="ai-insight-detail">
                      <strong>Review summary</strong>
                      <p>{insight.description}</p>
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