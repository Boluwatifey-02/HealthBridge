import {
  ArrowLeft,
  BrainCircuit,
  UserRoundCheck,
  CalendarClock,
  FileWarning,
  FileText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import api from '../services/api';
import './AIInsightsPage.css';

const defaultInsights = [
  {
    icon: CalendarClock,
    title: 'Follow-Up Recommendations',
    description:
      'Review patients whose history and recent activity suggest that a follow-up may be appropriate.',
    count: '0 patients',
    type: 'Follow-up',
  },
  {
    icon: UserRoundCheck,
    title: 'Duplicate Patient Detection',
    description:
      'Review possible duplicate patient records identified from matching patient information.',
    count: '0 records',
    type: 'Duplicate',
  },
  {
    icon: FileText,
    title: 'Automated Report Summaries',
    description:
      'Generate concise summaries of selected clinical and laboratory information for faster review.',
    count: '0 summaries',
    type: 'Reports',
  },
  {
    icon: FileWarning,
    title: 'Incomplete Records',
    description:
      'Identify patient records with missing information that may need to be completed.',
    count: '0 records',
    type: 'Incomplete',
  },
];

function AIInsightsPage({ onBack }) {
  const [activeInsight, setActiveInsight] = useState('Follow-Up Recommendations');
  const [insights, setInsights] = useState(defaultInsights);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const data = await api.getAIInsights();
        if (Array.isArray(data) && data.length > 0) {
          const mappedInsights = data.map((item) => ({
            icon: item.title.includes('Follow-Up') ? CalendarClock :
              item.title.includes('Duplicate') ? UserRoundCheck :
              item.title.includes('Report') ? FileText : FileWarning,
            title: item.title,
            description: item.description,
            count: item.count,
            type: item.type,
          }));
          setInsights(mappedInsights);
          setActiveInsight(mappedInsights[0]?.title || 'Follow-Up Recommendations');
        }
      } catch (error) {
        console.error('Unable to fetch AI insights:', error);
      }
    };

    loadInsights();
  }, []);

  return (
    <div className="ai-insights-page">
      <header className="ai-insights-header">
        <Brand dark />

        <button type="button" className="ai-insights-back" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>
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
                      <p>
                        {insight.title === 'Follow-Up Recommendations' &&
                          'Patients with older visit history and active clinical activity may benefit from a follow-up review within the next 48 hours.'}
                        {insight.title === 'Duplicate Patient Detection' &&
                          'Any matching identifiers or repeated contact details should be checked before updating the master patient profile.'}
                        {insight.title === 'Automated Report Summaries' &&
                          'This summary highlights recent consultation activity, pending lab work and current clinical follow-ups for a fast operational review.'}
                        {insight.title === 'Incomplete Records' &&
                          'Records that are missing allergies, condition details, phone numbers or addresses should be completed before the next clinical visit.'}
                      </p>
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