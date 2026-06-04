import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { Button, ButtonLink } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { isManagerAuthorized, logoutManager } from '../services/managerAuth';
import { getNotificationsByRecipient, getUnreadNotificationsCount, markNotificationAsRead } from '../services/notificationRepository';
import type { Notification, NotificationType } from '../types';

const typeLabels: Record<NotificationType, string> = {
  booking_created: 'Новая заявка',
  booking_confirmed: 'Заявка подтверждена',
  trainer_assigned: 'Назначение тренера',
  booking_time_changed: 'Изменение времени',
  booking_cancelled: 'Отмена заявки',
  trainer_response_required: 'Ответ тренера',
  booking_reminder_24h: 'Напоминание за 24 часа',
  booking_reminder_2h: 'Напоминание за 2 часа',
};

export function ManagerNotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [listResponse, unreadResponse] = await Promise.all([
          getNotificationsByRecipient('manager', 'manager-local'),
          getUnreadNotificationsCount('manager-local'),
        ]);
        setNotifications(listResponse.data.filter((item) => item.recipientRole === 'manager'));
        setUnreadCount(unreadResponse.data);
      } finally {
        setLoading(false);
      }
    };
    void loadNotifications();
  }, []);

  if (!isManagerAuthorized()) return <Navigate to="/staff/login" replace />;

  const filteredNotifications = useMemo(
    () => notifications.filter((item) => (filterType === 'all' ? true : item.type === filterType)),
    [notifications, filterType],
  );

  const handleMarkRead = async (id: string) => {
    const response = await markNotificationAsRead(id);
    if (!response.data) return;
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));
  };

  const handleLogout = () => {
    logoutManager();
    navigate('/staff/login', { replace: true });
  };

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading manager-dashboard-heading">
        <SectionTitle eyebrow="Управляющий" title="Центр уведомлений" text={`Непрочитанных уведомлений: ${unreadCount}`} />
        <StaffWorkspaceNav
          items={[
            { to: '/manager/dashboard', label: 'Дашборд' },
            { to: '/manager/bookings', label: 'Заявки' },
            { to: '/manager/calendar', label: 'Календарь' },
            { to: '/manager/notifications', label: `События (${unreadCount})` },
          ]}
          onLogout={handleLogout}
        />
      </div>

      <Link to="/manager/dashboard" className="back-link"><ArrowLeft size={17} /> Вернуться к дашборду</Link>

      <div className="form-card">
        <label>
          <span>Фильтр по типу</span>
          <select value={filterType} onChange={(event) => setFilterType(event.target.value as 'all' | NotificationType)}>
            <option value="all">Все уведомления</option>
            {Object.keys(typeLabels).map((type) => (
              <option key={type} value={type}>
                {typeLabels[type as NotificationType]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <div className="state-box">Загружаем уведомления...</div>}
      {!loading && filteredNotifications.length === 0 && <div className="state-box">Уведомлений по выбранному фильтру нет.</div>}

      {!loading && filteredNotifications.length > 0 && (
        <div className="admin-list">
          {filteredNotifications.map((item) => (
            <article className="booking-admin-card" key={item.id}>
              <div>
                <h3>{typeLabels[item.type] || item.type}</h3>
                <p>{item.message}</p>
                <span className={`status-pill ${item.isRead ? '' : 'status-needs_clarification'}`}>{item.isRead ? 'Прочитано' : 'Новое'}</span>
              </div>
              <p>{new Date(item.createdAt).toLocaleString('ru-RU')}</p>
              {!item.isRead && (
                <Button variant="secondary" onClick={() => void handleMarkRead(item.id)}>
                  Отметить прочитанным
                </Button>
              )}
              {item.bookingId && (
                <ButtonLink to={`/manager/bookings/${item.bookingId}`} variant="secondary">
                  Открыть заявку
                </ButtonLink>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
