import {
  Users,
  CalendarDays,
  Pill,
  FlaskConical,
  ArrowUpRight,
  Activity,
  Sparkles,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useCallback } from 'react';
import Brand from '../components/Brand';
import api from '../services/api';
import { useApiData } from '../hooks/useApiData';
import './DashboardPage.css';

const EMPTY_SUMMARY = {
  totals: { totalPatients: 0, appointments: 0, lowStockItems: 0, pendingLabRequests: 0 },
  today: {},
  attendance: [],
  breakdown: { appointments: {}, prescriptions: {}, labRequests: {} },
  recentActivity: [],
  inventoryAttention: [],
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function DashboardPage({
  user,
  onPatientsClick,
  onAppointmentsClick,
  onLaboratoryClick,
  onPharmacyClick,
  onAIInsightsClick,
  onSecurityClick,
  onLogout,
}) {
  const loadSummary = useCallback(() => api.getDashboardSummary(), []);
  const loadAppointments = useCallback(() => api.getAppointments({ pageSize: 6 }), []);

  const { data: summary, loading: summaryLoading, error: summaryError, refresh } = useApiData(loadSummary, []);
  const { data: appointments } = useApiData(loadAppointments, []);

  const metrics = summary || EMPTY_SUMMARY;
  const firstName = (user?.fullName || '').split(' ')[0] || 'there';

  // Only appointments from today onwards belong in "upcoming".
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (appointments?.appointments || [])
    .filter((appointment) => appointment.date >= today && appointment.status !== 'Cancelled')
    .slice(0, 5);

  const cards = [
    {
      key: 'patients',
      icon: Users,
      label: 'Active patients',
      value: metrics.totals.totalPatients,
      detail: `${metrics.today.newPatientsLast30Days || 0} registered in the last 30 days`,
      onClick: onPatientsClick,
    },
    {
      key: 'appointments',
      icon: CalendarDays,
      label: 'Appointments today',
      value: metrics.today.appointmentsToday ?? 0,
      detail: `${metrics.today.upcomingAppointments || 0} booked from today onwards`,
      onClick: onAppointmentsClick,
    },
    {
      key: 'lab',
      icon: FlaskConical,
      label: 'Laboratory queue',
      value: metrics.totals.pendingLabRequests,
      detail: `awaiting a result`,
      onClick: onLaboratoryClick,
    },
    {
      key: 'pharmacy',
      icon: Pill,
      label: 'Medicines low',
      value: metrics.totals.lowStockItems,
      detail: `at or below reorder level`,
      onClick: onPharmacyClick,
    },
  ];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand />

        <div className="dashboard-header-right">
          <span>HealthBridge</span>

          <div className="dashboard-header-actions">
            {onAIInsightsClick && (
              <button type="button" className="dashboard-header-button" onClick={onAIInsightsClick}>
                <Sparkles size={15} />
                Insights
              </button>
            )}

            {onSecurityClick && (
              <button type="button" className="dashboard-header-button" onClick={onSecurityClick}>
                <ShieldCheck size={15} />
                Security
              </button>
            )}

            {onLogout && (
              <button type="button" className="dashboard-header-button" onClick={onLogout}>
                <LogOut size={15} />
                Log out
              </button>
            )}

            <div className="dashboard-user" title={user?.fullName || ''}>
              {(user?.fullName || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-label">HEALTHCARE MANAGEMENT</span>
            <h1>
              {greeting()}
              {firstName !== 'there' ? `, ${firstName}.` : '.'}
            </h1>
            <p>
              {user?.role ? `Signed in as ${user.role}. ` : ''}
              {todayLabel()}
            </p>
          </div>

          <div className="dashboard-date">
            <button
              type="button"
              className="dashboard-header-button"
              onClick={refresh}
              disabled={summaryLoading}
            >
              <RefreshCw size={15} />
              {summaryLoading ? 'Loading' : 'Refresh'}
            </button>
          </div>
        </section>

        {summaryError && (
          <section className="dashboard-error" role="alert">
            <AlertTriangle size={16} />
            <span>Could not load the dashboard: {summaryError}</span>
            <button type="button" onClick={refresh}>Try again</button>
          </section>
        )}

        <section className="dashboard-stats">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                className="dashboard-stat-card"
                key={card.key}
                onClick={card.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') card.onClick?.();
                }}
              >
                <div className="dashboard-stat-icon">
                  <Icon size={20} />
                </div>
                <span>{card.label}</span>
                <strong>
                  {summaryLoading ? '—' : Number(card.value || 0).toLocaleString()}
                </strong>
                <small>{card.detail}</small>
              </article>
            );
          })}
        </section>

        <section className="dashboard-main-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-label">SCHEDULE</span>
                <h2>Upcoming appointments</h2>
              </div>

              {onAppointmentsClick && (
                <button type="button" onClick={onAppointmentsClick}>
                  View all <ArrowUpRight size={15} />
                </button>
              )}
            </div>

            <div className="appointment-list">
              {upcoming.length > 0 ? (
                upcoming.map((appointment) => (
                  <div className="appointment-row" key={appointment.id}>
                    <div className="appointment-time">{appointment.timeLabel || appointment.time}</div>
                    <div>
                      <strong>{appointment.reason || 'Consultation'}</strong>
                      <span>
                        {appointment.patient}
                        {appointment.doctor ? ` · ${appointment.doctor}` : ''}
                      </span>
                    </div>
                    <span
                      className={`appointment-status ${appointment.status === 'Pending' ? 'pending' : ''}`}
                    >
                      {appointment.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="appointment-row">
                  <div className="appointment-time">—</div>
                  <div>
                    <strong>No upcoming appointments</strong>
                    <span>Nothing is booked from today onwards.</span>
                  </div>
                  <span className="appointment-status pending">None</span>
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-panel dashboard-activity">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-label">AUDIT TRAIL</span>
                <h2>Recent activity</h2>
              </div>
              <Activity size={19} />
            </div>

            <div className="activity-list">
              {metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((entry) => (
                  <div key={entry.id}>
                    <strong>{entry.action.replace(/_/g, ' ').toLowerCase()}</strong>
                    <span>
                      {entry.actor}
                      {entry.at ? ` · ${new Date(entry.at).toLocaleString('en-GB')}` : ''}
                    </span>
                  </div>
                ))
              ) : (
                <div>
                  <strong>No recorded activity yet</strong>
                  <span>Every change made in HealthBridge is logged here as it happens.</span>
                </div>
              )}
            </div>
          </article>
        </section>

        {metrics.inventoryAttention.length > 0 && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-label">PHARMACY</span>
                <h2>Medicines needing restocking</h2>
              </div>

              {onPharmacyClick && (
                <button type="button" onClick={onPharmacyClick}>
                  Open pharmacy <ArrowUpRight size={15} />
                </button>
              )}
            </div>

            <div className="appointment-list">
              {metrics.inventoryAttention.map((item) => (
                <div className="appointment-row" key={item.id}>
                  <div className="appointment-time">{item.stock}</div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.shortfall > 0
                        ? `${item.shortfall} ${item.unit} below the reorder level of ${item.reorderLevel}`
                        : `At the reorder level of ${item.reorderLevel}`}
                    </span>
                  </div>
                  <span className="appointment-status pending">
                    {item.stock <= 0 ? 'Out of stock' : 'Low stock'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="dashboard-quick-actions">
          <div>
            <span className="dashboard-label">QUICK ACCESS</span>
            <h2>Go to a workflow</h2>
          </div>

          <div className="quick-action-grid">
            {onPatientsClick && (
              <button type="button" onClick={onPatientsClick}>
                <Users size={19} />
                <span>Patient Records</span>
                <ArrowUpRight size={15} />
              </button>
            )}

            {onAppointmentsClick && (
              <button type="button" onClick={onAppointmentsClick}>
                <CalendarDays size={19} />
                <span>Appointments</span>
                <ArrowUpRight size={15} />
              </button>
            )}

            {onPharmacyClick && (
              <button type="button" onClick={onPharmacyClick}>
                <Pill size={19} />
                <span>Pharmacy</span>
                <ArrowUpRight size={15} />
              </button>
            )}

            {onLaboratoryClick && (
              <button type="button" onClick={onLaboratoryClick}>
                <FlaskConical size={19} />
                <span>Laboratory</span>
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;
