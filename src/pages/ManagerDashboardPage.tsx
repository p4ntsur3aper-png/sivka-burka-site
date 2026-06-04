import { AlertTriangle, CalendarDays, ClipboardList, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { SectionTitle } from '../components/ui/SectionTitle';
import { isManagerAuthorized, logoutManager } from '../services/managerAuth';
import {
  getManagerAttentionBookings,
  getManagerDashboardStats,
  getManagerTodaySchedule,
} from '../services/managerRepository';
import type { Booking, ManagerAttentionBooking, ManagerDashboardStats } from '../types';

const DEFAULT_STATS: ManagerDashboardStats = {
  newRequestsCount: 0,
  todayBookingsCount: 0,
  unassignedBookingsCount: 0,
  needsClarificationCount: 0,
  confirmedThisWeekCount: 0,
  rejectedThisWeekCount: 0,
};

const statusLabels: Record<Booking['status'], string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  needs_clarification: 'Нужно уточнение',
  cancelled: 'Отменена',
};

export function ManagerDashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ManagerDashboardStats>(DEFAULT_STATS);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [attentionBookings, setAttentionBookings] = useState<ManagerAttentionBooking[]>([]);

  if (!isManagerAuthorized()) {
    return <Navigate to="/staff/login" replace />;
  }

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [statsResponse, todayResponse, attentionResponse] = await Promise.all([
        getManagerDashboardStats(),
        getManagerTodaySchedule(),
        getManagerAttentionBookings(),
      ]);
      setStats(statsResponse.data);
      setTodayBookings(todayResponse.data);
      setAttentionBookings(attentionResponse.data);
    } catch {
      setError('Не удалось загрузить данные дашборда. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    logoutManager();
    navigate('/staff/login', { replace: true });
  };

  const criticalAttention = useMemo(
    () => attentionBookings.filter((item) => item.booking.status === 'pending' || !item.booking.assignedTrainerId),
    [attentionBookings],
  );

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading manager-dashboard-heading">
        <SectionTitle
          eyebrow="Управляющий"
          title="Операционная панель конюшни"
          text="Краткая картина по заявкам, занятости и приоритетным вопросам на сегодня."
        />
        <StaffWorkspaceNav
          items={[
            { to: '/manager/dashboard', label: 'Дашборд' },
            { to: '/manager/bookings', label: 'Заявки' },
            { to: '/manager/calendar', label: 'Календарь' },
            { to: '/manager/notifications', label: 'События' },
          ]}
          onLogout={handleLogout}
        />
      </div>
      <div className="manager-dashboard-actions">
        <Button variant="secondary" onClick={loadData}>
          Обновить
        </Button>
      </div>

      {isLoading && <LoadingState text="Загружаем данные управляющего..." />}
      {error && <ErrorState text={error} />}

      {!isLoading && !error && (
        <>
          <div className="manager-stat-grid">
            <article className="manager-stat-card">
              <ClipboardList size={18} />
              <strong>{stats.newRequestsCount}</strong>
              <span>Новые заявки</span>
            </article>
            <article className="manager-stat-card">
              <CalendarDays size={18} />
              <strong>{stats.todayBookingsCount}</strong>
              <span>Занятий сегодня</span>
            </article>
            <article className="manager-stat-card">
              <UserRound size={18} />
              <strong>{stats.unassignedBookingsCount}</strong>
              <span>Без тренера</span>
            </article>
            <article className="manager-stat-card">
              <AlertTriangle size={18} />
              <strong>{stats.needsClarificationCount}</strong>
              <span>Нужны уточнения</span>
            </article>
          </div>

          <div className="manager-dashboard-columns">
            <article className="manager-panel">
              <h3>Ближайшие занятия</h3>
              {todayBookings.length === 0 ? (
                <p className="manager-muted">На сегодня занятий нет.</p>
              ) : (
                <div className="manager-list">
                  {todayBookings.slice(0, 6).map((booking) => (
                    <div key={booking.id} className="manager-list-item">
                      <div>
                        <strong>
                          {booking.startTime} - {booking.endTime}
                        </strong>
                        <p>{booking.clientName}</p>
                      </div>
                      <span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="manager-panel">
              <h3>Требуют внимания</h3>
              {attentionBookings.length === 0 ? (
                <p className="manager-muted">Критичных заявок сейчас нет.</p>
              ) : (
                <div className="manager-list">
                  {attentionBookings.slice(0, 6).map((item) => (
                    <div key={item.booking.id} className="manager-list-item manager-list-item--column">
                      <div className="manager-list-item-row">
                        <strong>
                          {item.booking.date} · {item.booking.startTime}
                        </strong>
                        <span className={`status-pill status-${item.booking.status}`}>{statusLabels[item.booking.status]}</span>
                      </div>
                      <p>
                        {item.booking.clientName} · причин: {item.reasons.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <div className="state-box">
            За неделю: подтверждено {stats.confirmedThisWeekCount}, отклонено {stats.rejectedThisWeekCount}. Приоритетных заявок
            (новые или без тренера): {criticalAttention.length}.
          </div>
        </>
      )}
    </section>
  );
}
