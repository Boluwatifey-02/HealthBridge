import {
  Users,
  CalendarDays,
  Pill,
  FlaskConical,
  ArrowUpRight,
  Activity,
  Clock3,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Brand from '../components/Brand';
import api from '../services/api';
import './DashboardPage.css';

const defaultDashboardState = {
  totalPatients: 0,
  appointments: 0,
  pharmacyItems: 0,
  labRequests: 0,
  pendingLabRequests: 0,
  upcomingAppointments: [],
  recentActivity: [],
};

function DashboardPage({onPatientsClick, onAppointmentsClick, onLaboratoryClick, onPharmacyClick}) {
  const [dashboard, setDashboard] = useState(defaultDashboardState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);

        const [summary, patients, appointments, medicines, labRequests, consultations] = await Promise.all([
          api.getDashboardSummary().catch(() => ({ totalPatients: 0, appointments: 0, lowStockItems: 0, pendingLabRequests: 0 })),
          api.getPatients().catch(() => []),
          api.getAppointments().catch(() => []),
          api.getPharmacy().catch(() => []),
          api.getLabRequests().catch(() => []),
          api.getConsultations().catch(() => []),
        ]);

        if (!isMounted) return;

        const upcomingAppointments = (Array.isArray(appointments) ? appointments : []).slice(0, 3).map((appointment) => ({
          time: appointment.time || '09:00',
          title: appointment.reason || appointment.type || 'Consultation',
          location: appointment.provider || appointment.doctor || 'Clinical Care',
          status: appointment.status || 'Scheduled',
        }));

        const recentActivity = [
          ...(Array.isArray(consultations) ? consultations : []).slice(0, 2).map((consultation) => ({
            title: 'Clinical consultation recorded',
            detail: `${consultation.patient || 'Patient'} · ${consultation.date || 'recently'}`,
          })),
          ...(Array.isArray(labRequests) ? labRequests : []).slice(0, 2).map((request) => ({
            title: 'Laboratory request updated',
            detail: `${request.patient || 'Patient'} · ${request.status || 'Pending'}`,
          })),
        ].slice(0, 4);

        setDashboard({
          totalPatients: Number(summary.totalPatients ?? patients.length ?? 0),
          appointments: Number(summary.appointments ?? appointments.length ?? 0),
          pharmacyItems: Number(medicines.length ?? 0),
          labRequests: Number(labRequests.length ?? 0),
          pendingLabRequests: Number(summary.pendingLabRequests ?? labRequests.filter((item) => item.status === 'Pending').length ?? 0),
          upcomingAppointments,
          recentActivity,
        });
      } catch (error) {
        console.error('Unable to load dashboard summary:', error);
        if (isMounted) {
          setDashboard(defaultDashboardState);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand />

        <div className="dashboard-header-right">
          <span>HealthBridge</span>
          <div className="dashboard-user">A</div>
        </div>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <span className="dashboard-label">HEALTHCARE MANAGEMENT</span>
            <h1>Good morning.</h1>
            <p>
              Here is an overview of activity across your healthcare centre.
            </p>
          </div>

          <div className="dashboard-date">
            <Clock3 size={16} />
            <span>Today</span>
          </div>
        </section>

        <section className="dashboard-stats">
          <article className="dashboard-stat-card" onClick={onPatientsClick} role="button" tabIndex={0}>
            <div className="dashboard-stat-icon">
              <Users size={20} />
            </div>
            <span>Total Patients</span>
            <strong>{loading ? '—' : dashboard.totalPatients.toLocaleString()}</strong>
            <small>{dashboard.totalPatients ? 'Live database count' : 'Waiting for data'}</small>
          </article>

          <article className="dashboard-stat-card" onClick={onAppointmentsClick} role="button" tabIndex={0}>
            <div className="dashboard-stat-icon">
              <CalendarDays size={20} />
            </div>
            <span>Appointments</span>
            <strong>{loading ? '—' : dashboard.appointments}</strong>
            <small>{dashboard.upcomingAppointments.length ? `${dashboard.upcomingAppointments.length} scheduled` : 'No upcoming items'}</small>
          </article>

          <article className="dashboard-stat-card" onClick={onPharmacyClick} role="button" tabIndex={0}>
            <div className="dashboard-stat-icon">
              <Pill size={20} />
            </div>
            <span>Pharmacy Items</span>
            <strong>{loading ? '—' : dashboard.pharmacyItems}</strong>
            <small>{dashboard.pendingLabRequests ? `${dashboard.pendingLabRequests} need attention` : 'Inventory active'}</small>
          </article>

          <article className="dashboard-stat-card" onClick={onLaboratoryClick} role="button" tabIndex={0}>
            <div className="dashboard-stat-icon">
              <FlaskConical size={20} />
            </div>
            <span>Lab Requests</span>
            <strong>{loading ? '—' : dashboard.labRequests}</strong>
            <small>{dashboard.pendingLabRequests ? `${dashboard.pendingLabRequests} awaiting results` : 'No pending lab items'}</small>
          </article>
        </section>

        <section className="dashboard-main-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-label">TODAY</span>
                <h2>Upcoming appointments</h2>
              </div>

              <button type="button">
                View all <ArrowUpRight size={15} />
              </button>
            </div>

            <div className="appointment-list">
              {dashboard.upcomingAppointments.length > 0 ? (
                dashboard.upcomingAppointments.map((appointment) => (
                  <div className="appointment-row" key={`${appointment.title}-${appointment.time}`}>
                    <div className="appointment-time">{appointment.time}</div>
                    <div>
                      <strong>{appointment.title}</strong>
                      <span>{appointment.location}</span>
                    </div>
                    <span className={`appointment-status ${appointment.status === 'Pending' ? 'pending' : ''}`}>
                      {appointment.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="appointment-row">
                  <div className="appointment-time">—</div>
                  <div>
                    <strong>No appointments loaded</strong>
                    <span>Check the appointments workflow for live entries.</span>
                  </div>
                  <span className="appointment-status pending">Awaiting data</span>
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-panel dashboard-activity">
            <div className="dashboard-panel-heading">
              <div>
                <span className="dashboard-label">ACTIVITY</span>
                <h2>Recent activity</h2>
              </div>
              <Activity size={19} />
            </div>

            <div className="activity-list">
              {dashboard.recentActivity.length > 0 ? (
                dashboard.recentActivity.map((activity, index) => (
                  <div key={`${activity.title}-${index}`}>
                    <strong>{activity.title}</strong>
                    <span>{activity.detail}</span>
                  </div>
                ))
              ) : (
                <div>
                  <strong>No recent activity</strong>
                  <span>Recent patient or lab updates will appear here.</span>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="dashboard-quick-actions">
          <div>
            <span className="dashboard-label">QUICK ACCESS</span>
            <h2>Go to a workflow</h2>
          </div>

          <div className="quick-action-grid">
            <button type="button" onClick={onPatientsClick}>
              <Users size={19} />
              <span>Patient Records</span>
              <ArrowUpRight size={15} />
            </button>

            <button type="button" onClick={onAppointmentsClick}>
              <CalendarDays size={19} />
              <span>Appointments</span>
              <ArrowUpRight size={15} />
            </button>

            <button type="button" onClick={onPharmacyClick}>
              <Pill size={19} />
              <span>Pharmacy</span>
              <ArrowUpRight size={15} />
            </button>

            <button type="button" onClick={onLaboratoryClick}>
              <FlaskConical size={19} />
              <span>Laboratory</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;