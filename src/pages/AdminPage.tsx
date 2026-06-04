import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, LogOut, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ImageUploadButton } from '../components/admin/ImageUploadButton';
import { Button, ButtonLink } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import {
  createEmptyBookingRule,
  createEmptyGalleryItem,
  createEmptyHorse,
  createEmptyTrainer,
  createEmptyService,
  getEditableBookingRules,
  getEditableBookings,
  getEditableContacts,
  getEditableGalleryItems,
  getEditableHorses,
  getEditableTrainers,
  getEditableReviews,
  getEditableRulesInfo,
  getEditableServices,
  getEditableSiteContent,
  isAdminAuthorized,
  loginAdmin,
  logoutAdmin,
  resetEditableContent,
  saveEditableBookingRules,
  saveEditableBookings,
  saveEditableContacts,
  saveEditableGalleryItems,
  saveEditableHorses,
  saveEditableTrainers,
  saveEditableReviews,
  saveEditableRulesInfo,
  saveEditableServices,
  saveEditableSiteContent,
} from '../services/adminContent';
import { checkBookingAvailability, getAvailableTimeSlots } from '../services/availabilityService';
import { assignBookingTrainer, updateBookingTrainerStatus } from '../services/api';
import { getAdminSnapshot, resetBackendData, saveAdminSnapshot, type AdminSnapshot } from '../services/backendApi';
import { env } from '../services/env';
import {
  getStaffAccounts,
  requestBrowserNotificationPermission,
  saveStaffAccounts,
  syncStaffAccountsWithTrainers,
} from '../services/staffSettings';
import type { Booking, BookingRule, BookingRuleType, BookingStatus, ContactInfo, GalleryItem, Horse, HorseStatus, Review, RulesInfo, Service, SiteContent, StaffAccount, StaffNotificationSettings, Trainer, TrainerStatus } from '../types';
import { getMediaStyle } from '../utils/media';

type AdminTab = 'appearance' | 'services' | 'gallery' | 'horses' | 'trainers' | 'staff' | 'calendar' | 'content' | 'rules';

const categoryOptions: { value: GalleryItem['category']; label: string }[] = [
  { value: 'lessons', label: 'Занятия' },
  { value: 'walks', label: 'Прогулки' },
  { value: 'photosessions', label: 'Фотосессии' },
  { value: 'horses', label: 'Лошади' },
  { value: 'territory', label: 'Территория' },
];

const horseStatuses: { value: HorseStatus; label: string }[] = [
  { value: 'available', label: 'Доступна' },
  { value: 'unavailable', label: 'Недоступна' },
  { value: 'rest', label: 'Отдых' },
  { value: 'treatment', label: 'Лечение' },
  { value: 'busy', label: 'Занята' },
];

const bookingStatuses: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Ожидает подтверждения' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'needs_clarification', label: 'Требуется уточнение' },
  { value: 'cancelled', label: 'Отменена' },
];

const trainerStatuses: { value: TrainerStatus; label: string }[] = [
  { value: 'active', label: 'Активен' },
  { value: 'unavailable', label: 'Временно недоступен' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick_leave', label: 'Больничный' },
];

const ruleTypes: { value: BookingRuleType; label: string }[] = [
  { value: 'horse_rest_after_lesson', label: 'Перерыв после занятия' },
  { value: 'working_hours', label: 'Рабочие часы' },
  { value: 'closed_date', label: 'Закрытая дата' },
  { value: 'horse_unavailable', label: 'Недоступность лошади' },
  { value: 'max_weight', label: 'Максимальный вес' },
  { value: 'service_duration', label: 'Длительность услуги' },
  { value: 'custom_exception', label: 'Исключение' },
];

const weekDayOptions = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

const staffRoleLabels = {
  admin: 'Администратор',
  manager: 'Управляющий',
  trainer: 'Тренер',
};

const splitLines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const joinLines = (items: string[]) => items.join('\n');
const todayIso = () => new Date().toISOString().slice(0, 10);
const swapByDirection = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const current = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = current;
  return copy;
};

function getDefaultRuleConfig(type: BookingRuleType): Record<string, unknown> {
  if (type === 'working_hours') {
    return { workingWeekDays: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '18:00', slotStepMinutes: 30 };
  }
  if (type === 'horse_rest_after_lesson') return { restMinutes: 30 };
  if (type === 'closed_date') return { dates: [todayIso()], weekDays: [], reason: 'Выбранный день закрыт для записи' };
  if (type === 'horse_unavailable') return { horseId: '', date: todayIso(), startTime: '09:00', endTime: '18:00', reason: 'Лошадь недоступна в выбранный период' };
  if (type === 'max_weight') return { horseId: '', maxRiderWeightKg: 80, reason: 'Ограничение по весу' };
  if (type === 'service_duration') return { serviceId: '', durationMinutes: 60 };
  return { description: 'Описание исключения' };
}

function configString(config: Record<string, unknown>, key: string, fallback = '') {
  const value = config[key];
  return typeof value === 'string' ? value : fallback;
}

function configNumber(config: Record<string, unknown>, key: string, fallback = 0) {
  const value = config[key];
  return typeof value === 'number' ? value : fallback;
}

function configStringArray(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function configNumberArray(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : [];
}

export function AdminPage() {
  const [authorized, setAuthorized] = useState(isAdminAuthorized());
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('appearance');
  const [siteContent, setSiteContent] = useState<SiteContent>(getEditableSiteContent());
  const [services, setServices] = useState<Service[]>(getEditableServices());
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(getEditableGalleryItems());
  const [horses, setHorses] = useState<Horse[]>(getEditableHorses());
  const [trainers, setTrainers] = useState<Trainer[]>(getEditableTrainers());
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() => getStaffAccounts(getEditableTrainers()));
  const [bookings, setBookings] = useState<Booking[]>(getEditableBookings());
  const [bookingRules, setBookingRules] = useState<BookingRule[]>(getEditableBookingRules());
  const [reviews, setReviews] = useState<Review[]>(getEditableReviews());
  const [contacts, setContacts] = useState<ContactInfo>(getEditableContacts());
  const [rulesInfo, setRulesInfo] = useState<RulesInfo>(getEditableRulesInfo());
  const [calendarDate, setCalendarDate] = useState('2026-06-10');
  const [calendarServiceId, setCalendarServiceId] = useState(services[0]?.id || '');
  const [savedMessage, setSavedMessage] = useState('');

  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse])), [horses]);
  const trainerById = useMemo(() => new Map(trainers.map((trainer) => [trainer.id, trainer])), [trainers]);
  const dayBookings = bookings.filter((booking) => booking.date === calendarDate).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const previewSlots = calendarServiceId ? getAvailableTimeSlots(calendarServiceId, calendarDate) : [];

  const applySnapshot = (snapshot: AdminSnapshot) => {
    setSiteContent(snapshot.siteContent);
    setServices(snapshot.services);
    setGalleryItems(snapshot.galleryItems);
    setHorses(snapshot.horses);
    setTrainers(snapshot.trainers);
    setStaffAccounts(snapshot.staffAccounts);
    setBookings(snapshot.bookings);
    setBookingRules(snapshot.bookingRules);
    setReviews(snapshot.reviews);
    setContacts(snapshot.contacts);
    setRulesInfo(snapshot.rulesInfo);
    setCalendarServiceId(snapshot.services[0]?.id || '');
  };

  useEffect(() => {
    if (!authorized || env.useMockApi) return;
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const response = await getAdminSnapshot();
        if (!cancelled) applySnapshot(response.data);
      } catch {
        if (!cancelled) setSavedMessage('Не удалось загрузить данные из backend. Проверьте авторизацию и сервер.');
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (await loginAdmin(login, password)) {
      setAuthorized(true);
      setLoginError('');
      return;
    }
    setLoginError('Неверный логин или пароль администратора.');
  };

  const saveAll = async () => {
    const syncedStaffAccounts = syncStaffAccountsWithTrainers(staffAccounts, trainers);

    if (!env.useMockApi) {
      try {
        const response = await saveAdminSnapshot({
          siteContent,
          services,
          galleryItems,
          horses,
          trainers,
          staffAccounts: syncedStaffAccounts,
          bookings,
          bookingRules,
          reviews,
          contacts,
          rulesInfo,
        });
        applySnapshot(response.data);
        setSavedMessage('Изменения сохранены в SQLite через backend.');
      } catch {
        setSavedMessage('Не удалось сохранить изменения в backend.');
      }
      window.setTimeout(() => setSavedMessage(''), 3500);
      return;
    }

    saveEditableServices(services);
    saveEditableGalleryItems(galleryItems);
    saveEditableHorses(horses);
    saveEditableTrainers(trainers);
    saveStaffAccounts(syncedStaffAccounts);
    setStaffAccounts(syncedStaffAccounts);
    saveEditableBookings(bookings);
    saveEditableBookingRules(bookingRules);
    saveEditableReviews(reviews);
    saveEditableContacts(contacts);
    saveEditableRulesInfo(rulesInfo);
    saveEditableSiteContent(siteContent);
    setSavedMessage('Изменения сохранены в браузере и уже используются в клиентской форме.');
    window.setTimeout(() => setSavedMessage(''), 3500);
  };

  const resetAll = async () => {
    if (!env.useMockApi) {
      try {
        await resetBackendData();
        const response = await getAdminSnapshot();
        applySnapshot(response.data);
        setSavedMessage('Данные в SQLite восстановлены из seed.');
      } catch {
        setSavedMessage('Не удалось восстановить данные backend.');
      }
      window.setTimeout(() => setSavedMessage(''), 3500);
      return;
    }

    resetEditableContent();
    setServices(getEditableServices());
    setGalleryItems(getEditableGalleryItems());
    setHorses(getEditableHorses());
    setTrainers(getEditableTrainers());
    setStaffAccounts(getStaffAccounts(getEditableTrainers()));
    setBookings(getEditableBookings());
    setBookingRules(getEditableBookingRules());
    setReviews(getEditableReviews());
    setContacts(getEditableContacts());
    setRulesInfo(getEditableRulesInfo());
    setSiteContent(getEditableSiteContent());
    setSavedMessage('Демо-данные восстановлены.');
    window.setTimeout(() => setSavedMessage(''), 3500);
  };

  const updateService = <K extends keyof Service>(id: string, field: K, value: Service[K]) => {
    setServices((current) => current.map((service) => (service.id === id ? { ...service, [field]: value } : service)));
  };

  const updateSiteContent = <K extends keyof SiteContent>(field: K, value: SiteContent[K]) => {
    setSiteContent((current) => ({ ...current, [field]: value }));
  };

  const updateGalleryItem = <K extends keyof GalleryItem>(id: string, field: K, value: GalleryItem[K]) => {
    setGalleryItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const updateHorse = <K extends keyof Horse>(id: string, field: K, value: Horse[K]) => {
    setHorses((current) => current.map((horse) => (horse.id === id ? { ...horse, [field]: value } : horse)));
  };

  const updateTrainer = <K extends keyof Trainer>(id: string, field: K, value: Trainer[K]) => {
    setTrainers((current) => {
      const nextTrainers = current.map((trainer) => (trainer.id === id ? { ...trainer, [field]: value } : trainer));
      if (field === 'fullName' || field === 'email' || field === 'phone') {
        setStaffAccounts((accounts) => syncStaffAccountsWithTrainers(accounts, nextTrainers));
      }
      return nextTrainers;
    });
  };

  const addTrainer = () => {
    const trainer = createEmptyTrainer(services.map((service) => service.id));
    setTrainers((current) => {
      const nextTrainers = [trainer, ...current];
      setStaffAccounts((accounts) => syncStaffAccountsWithTrainers(accounts, nextTrainers));
      return nextTrainers;
    });
  };

  const deleteTrainer = (trainerId: string) => {
    setTrainers((current) => {
      const nextTrainers = current.filter((item) => item.id !== trainerId);
      setStaffAccounts((accounts) => syncStaffAccountsWithTrainers(accounts, nextTrainers));
      return nextTrainers;
    });
  };

  const updateStaffAccount = <K extends keyof StaffAccount>(id: string, field: K, value: StaffAccount[K]) => {
    setStaffAccounts((current) => current.map((account) => (account.id === id ? { ...account, [field]: value } : account)));
  };

  const updateStaffNotification = <K extends keyof StaffNotificationSettings>(
    id: string,
    field: K,
    value: StaffNotificationSettings[K],
  ) => {
    setStaffAccounts((current) =>
      current.map((account) =>
        account.id === id
          ? {
              ...account,
              notificationSettings: {
                ...account.notificationSettings,
                [field]: value,
              },
            }
          : account,
      ),
    );
  };

  const handleEnableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    if (permission === 'granted') {
      setSavedMessage('Уведомления браузера разрешены. Включите канал у нужных сотрудников и сохраните изменения.');
    } else if (permission === 'denied') {
      setSavedMessage('Браузер заблокировал уведомления. Разрешите их в настройках сайта.');
    } else {
      setSavedMessage('Этот браузер не поддерживает локальные уведомления.');
    }
    window.setTimeout(() => setSavedMessage(''), 3500);
  };

  const updateBooking = <K extends keyof Booking>(id: string, field: K, value: Booking[K]) => {
    setBookings((current) => current.map((booking) => (booking.id === id ? { ...booking, [field]: value } : booking)));
  };

  const updateBookingRule = <K extends keyof BookingRule>(id: string, field: K, value: BookingRule[K]) => {
    setBookingRules((current) => current.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)));
  };

  const updateBookingRuleConfig = (id: string, patch: Record<string, unknown>) => {
    setBookingRules((current) => current.map((rule) => (rule.id === id ? { ...rule, config: { ...rule.config, ...patch } } : rule)));
  };

  const changeBookingRuleType = (id: string, type: BookingRuleType) => {
    setBookingRules((current) => current.map((rule) => (rule.id === id ? { ...rule, type, config: getDefaultRuleConfig(type) } : rule)));
  };

  const updateRuleArrayConfig = (id: string, key: string, items: string[] | number[]) => {
    setBookingRules((current) => current.map((rule) => (rule.id === id ? { ...rule, config: { ...rule.config, [key]: items } } : rule)));
  };

  const toggleRuleWeekday = (rule: BookingRule, key: string, day: number) => {
    const currentDays = configNumberArray(rule.config, key);
    const nextDays = currentDays.includes(day) ? currentDays.filter((item) => item !== day) : [...currentDays, day];
    updateRuleArrayConfig(rule.id, key, nextDays);
  };

  const handleAssignTrainer = async (bookingId: string, trainerId: string) => {
    const response = await assignBookingTrainer(bookingId, trainerId || undefined);
    if (!response.data) return;
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              assignedTrainerId: response.data?.assignedTrainerId,
              trainerStatus: response.data?.trainerStatus,
            }
          : booking,
      ),
    );
  };

  const handleTrainerStatusChange = async (bookingId: string, trainerStatus: Booking['trainerStatus']) => {
    const response = await updateBookingTrainerStatus(bookingId, trainerStatus);
    if (!response.data) return;
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              trainerStatus: response.data?.trainerStatus,
            }
          : booking,
      ),
    );
  };

  const renderBookingRuleConfig = (rule: BookingRule) => {
    if (rule.type === 'horse_rest_after_lesson') {
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label>
            <span>Перерыв после занятия, минут</span>
            <input
              type="number"
              min="0"
              step="5"
              value={configNumber(rule.config, 'restMinutes', 30)}
              onChange={(event) => updateBookingRuleConfig(rule.id, { restMinutes: Number(event.target.value) })}
            />
          </label>
        </div>
      );
    }

    if (rule.type === 'working_hours') {
      const activeDays = configNumberArray(rule.config, 'workingWeekDays');
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label>
            <span>Начало рабочего дня</span>
            <input type="time" value={configString(rule.config, 'startTime', '09:00')} onChange={(event) => updateBookingRuleConfig(rule.id, { startTime: event.target.value })} />
          </label>
          <label>
            <span>Конец рабочего дня</span>
            <input type="time" value={configString(rule.config, 'endTime', '18:00')} onChange={(event) => updateBookingRuleConfig(rule.id, { endTime: event.target.value })} />
          </label>
          <label>
            <span>Шаг слотов, минут</span>
            <select value={configNumber(rule.config, 'slotStepMinutes', 30)} onChange={(event) => updateBookingRuleConfig(rule.id, { slotStepMinutes: Number(event.target.value) })}>
              {[15, 30, 45, 60].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="admin-wide">
            <span className="field-title">Рабочие дни</span>
            <div className="rule-check-grid">
              {weekDayOptions.map((day) => (
                <label className="checkbox-label" key={day.value}>
                  <input type="checkbox" checked={activeDays.includes(day.value)} onChange={() => toggleRuleWeekday(rule, 'workingWeekDays', day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (rule.type === 'closed_date') {
      const dates = configStringArray(rule.config, 'dates');
      const closedWeekDays = configNumberArray(rule.config, 'weekDays');
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label className="admin-wide">
            <span>Причина закрытия</span>
            <input value={configString(rule.config, 'reason', 'Выбранный день закрыт для записи')} onChange={(event) => updateBookingRuleConfig(rule.id, { reason: event.target.value })} />
          </label>
          <div className="admin-wide rule-list-editor">
            <div className="admin-list-header">
              <h4>Закрытые даты</h4>
              <Button variant="secondary" onClick={() => updateRuleArrayConfig(rule.id, 'dates', [...dates, todayIso()])}>Добавить дату</Button>
            </div>
            {dates.length === 0 && <p className="form-note">Отдельные даты не выбраны.</p>}
            {dates.map((date, index) => (
              <div className="rule-row" key={`${date}-${index}`}>
                <input type="date" value={date} onChange={(event) => updateRuleArrayConfig(rule.id, 'dates', dates.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                <Button variant="ghost" className="danger-button" onClick={() => updateRuleArrayConfig(rule.id, 'dates', dates.filter((_, itemIndex) => itemIndex !== index))}>Удалить</Button>
              </div>
            ))}
          </div>
          <div className="admin-wide">
            <span className="field-title">Повторяющиеся закрытые дни недели</span>
            <div className="rule-check-grid">
              {weekDayOptions.map((day) => (
                <label className="checkbox-label" key={day.value}>
                  <input type="checkbox" checked={closedWeekDays.includes(day.value)} onChange={() => toggleRuleWeekday(rule, 'weekDays', day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (rule.type === 'horse_unavailable') {
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label>
            <span>Лошадь</span>
            <select value={configString(rule.config, 'horseId')} onChange={(event) => updateBookingRuleConfig(rule.id, { horseId: event.target.value })}>
              <option value="">Выберите лошадь</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </select>
          </label>
          <label>
            <span>Дата</span>
            <input type="date" value={configString(rule.config, 'date', todayIso())} onChange={(event) => updateBookingRuleConfig(rule.id, { date: event.target.value })} />
          </label>
          <label>
            <span>Начало</span>
            <input type="time" value={configString(rule.config, 'startTime', '09:00')} onChange={(event) => updateBookingRuleConfig(rule.id, { startTime: event.target.value })} />
          </label>
          <label>
            <span>Конец</span>
            <input type="time" value={configString(rule.config, 'endTime', '18:00')} onChange={(event) => updateBookingRuleConfig(rule.id, { endTime: event.target.value })} />
          </label>
          <label className="admin-wide">
            <span>Причина</span>
            <input value={configString(rule.config, 'reason', 'Лошадь недоступна в выбранный период')} onChange={(event) => updateBookingRuleConfig(rule.id, { reason: event.target.value })} />
          </label>
        </div>
      );
    }

    if (rule.type === 'max_weight') {
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label>
            <span>Лошадь</span>
            <select value={configString(rule.config, 'horseId')} onChange={(event) => updateBookingRuleConfig(rule.id, { horseId: event.target.value })}>
              <option value="">Общее правило</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </select>
          </label>
          <label>
            <span>Максимальный вес, кг</span>
            <input type="number" min="1" value={configNumber(rule.config, 'maxRiderWeightKg', 80)} onChange={(event) => updateBookingRuleConfig(rule.id, { maxRiderWeightKg: Number(event.target.value) })} />
          </label>
          <label className="admin-wide">
            <span>Комментарий</span>
            <input value={configString(rule.config, 'reason', 'Ограничение по весу')} onChange={(event) => updateBookingRuleConfig(rule.id, { reason: event.target.value })} />
          </label>
        </div>
      );
    }

    if (rule.type === 'service_duration') {
      return (
        <div className="admin-form-grid admin-wide rule-builder">
          <label>
            <span>Услуга</span>
            <select value={configString(rule.config, 'serviceId')} onChange={(event) => updateBookingRuleConfig(rule.id, { serviceId: event.target.value })}>
              <option value="">Выберите услугу</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
            </select>
          </label>
          <label>
            <span>Длительность, минут</span>
            <input type="number" min="15" step="15" value={configNumber(rule.config, 'durationMinutes', 60)} onChange={(event) => updateBookingRuleConfig(rule.id, { durationMinutes: Number(event.target.value) })} />
          </label>
        </div>
      );
    }

    return (
      <div className="admin-form-grid admin-wide rule-builder">
        <label className="admin-wide">
          <span>Описание исключения</span>
          <textarea value={configString(rule.config, 'description', 'Описание исключения')} onChange={(event) => updateBookingRuleConfig(rule.id, { description: event.target.value })} rows={3} />
        </label>
      </div>
    );
  };

  if (!authorized) {
    return (
      <section className="page-section admin-page">
        <SectionTitle
          eyebrow="Администрирование"
          title="Вход для управления контентом"
          text="Это вход в административный раздел. Авторизацию и права доступа должен проверять сервер."
        />
        <form className="form-card admin-login" onSubmit={handleLogin}>
          <label><span>Логин</span><input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" /></label>
          <label><span>Пароль</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
          {loginError && <small className="standalone-error">{loginError}</small>}
          <Button type="submit">Войти</Button>
          <p className="form-note">Учетные данные выдаются администратором клуба.</p>
        </form>
      </section>
    );
  }

  return (
    <section className="page-section admin-page">
      <div className="admin-heading">
        <SectionTitle
          eyebrow="Администрирование"
          title="Управление расписанием конюшни"
          text="Здесь редактируются услуги, фотографии, лошади, заявки и правила доступности."
        />
        <div className="admin-actions">
          <ButtonLink to="/admin/notifications" variant="secondary">Notifications</ButtonLink>
          <Button variant="secondary" onClick={resetAll}><RotateCcw size={18} /> Сбросить данные</Button>
          <Button variant="primary" onClick={saveAll}><Save size={18} /> Сохранить изменения</Button>
          <Button variant="ghost" onClick={() => { logoutAdmin(); setAuthorized(false); }}><LogOut size={18} /> Выйти</Button>
        </div>
      </div>

      {savedMessage && <div className="alert alert-success">{savedMessage}</div>}

      <div className="admin-tabs" role="tablist" aria-label="Разделы администрирования">
        {[
          ['appearance', 'Оформление'],
          ['services', 'Услуги'],
          ['gallery', 'Галерея'],
          ['horses', 'Лошади'],
          ['trainers', 'Тренеры'],
          ['staff', 'Доступы'],
          ['calendar', 'Календарь'],
          ['content', 'Контент'],
          ['rules', 'Правила записи'],
        ].map(([value, label]) => (
          <Button key={value} variant={activeTab === value ? 'primary' : 'secondary'} onClick={() => setActiveTab(value as AdminTab)}>
            {label}
          </Button>
        ))}
      </div>

      {activeTab === 'appearance' && (
        <div className="admin-list">
          <div className="admin-list-header">
            <h2>Оформление главной страницы</h2>
            <Button variant="secondary" onClick={() => saveEditableSiteContent(siteContent)}>
              <Save size={18} /> Сохранить только оформление
            </Button>
          </div>

          <article className="admin-editor appearance-editor">
            <div className="appearance-preview">
              <div className="appearance-preview-media" style={getMediaStyle(siteContent.homeHeroImage)}>
                <span>{siteContent.siteName}</span>
              </div>
              <div className="appearance-preview-content">
                <span className="eyebrow">{siteContent.homeEyebrow}</span>
                <h3>{siteContent.homeHeroTitle}</h3>
                <p>{siteContent.homeHeroText}</p>
              </div>
            </div>

            <div className="admin-form-grid">
              <label>
                <span>Название сайта</span>
                <input value={siteContent.siteName} onChange={(event) => updateSiteContent('siteName', event.target.value)} />
              </label>
              <label>
                <span>Подпись бренда</span>
                <input value={siteContent.siteSubtitle} onChange={(event) => updateSiteContent('siteSubtitle', event.target.value)} />
              </label>
              <label className="admin-wide">
                <span>Надзаголовок главной</span>
                <input value={siteContent.homeEyebrow} onChange={(event) => updateSiteContent('homeEyebrow', event.target.value)} />
              </label>
              <label className="admin-wide">
                <span>Главный заголовок</span>
                <textarea value={siteContent.homeHeroTitle} onChange={(event) => updateSiteContent('homeHeroTitle', event.target.value)} rows={2} />
              </label>
              <label className="admin-wide">
                <span>Текст под заголовком</span>
                <textarea value={siteContent.homeHeroText} onChange={(event) => updateSiteContent('homeHeroText', event.target.value)} rows={3} />
              </label>
              <label>
                <span>Фото главной или CSS-gradient</span>
                <input value={siteContent.homeHeroImage} onChange={(event) => updateSiteContent('homeHeroImage', event.target.value)} />
              </label>
              <label>
                <span>Позиция фото</span>
                <select value={siteContent.homeHeroImagePosition} onChange={(event) => updateSiteContent('homeHeroImagePosition', event.target.value)}>
                  <option value="center">По центру</option>
                  <option value="top">Сверху</option>
                  <option value="bottom">Снизу</option>
                  <option value="left center">Слева</option>
                  <option value="right center">Справа</option>
                </select>
              </label>
              <ImageUploadButton label="Добавить файл главной" onUpload={(dataUrl) => updateSiteContent('homeHeroImage', dataUrl)} />
              <label>
                <span>Основной цвет</span>
                <input type="color" value={siteContent.primaryColor} onChange={(event) => updateSiteContent('primaryColor', event.target.value)} />
              </label>
              <label>
                <span>Темный цвет</span>
                <input type="color" value={siteContent.darkColor} onChange={(event) => updateSiteContent('darkColor', event.target.value)} />
              </label>
              <label>
                <span>Акцентный цвет</span>
                <input type="color" value={siteContent.accentColor} onChange={(event) => updateSiteContent('accentColor', event.target.value)} />
              </label>
              <label>
                <span>Заголовок популярных услуг</span>
                <input value={siteContent.popularServicesTitle} onChange={(event) => updateSiteContent('popularServicesTitle', event.target.value)} />
              </label>
              <label className="admin-wide">
                <span>Текст блока услуг</span>
                <textarea value={siteContent.popularServicesText} onChange={(event) => updateSiteContent('popularServicesText', event.target.value)} rows={2} />
              </label>
              <label>
                <span>Заголовок блока доверия</span>
                <input value={siteContent.trustTitle} onChange={(event) => updateSiteContent('trustTitle', event.target.value)} />
              </label>
              <label>
                <span>Заголовок отзывов</span>
                <input value={siteContent.reviewsTitle} onChange={(event) => updateSiteContent('reviewsTitle', event.target.value)} />
              </label>
              <label className="admin-wide">
                <span>Текст блока доверия</span>
                <textarea value={siteContent.trustText} onChange={(event) => updateSiteContent('trustText', event.target.value)} rows={3} />
              </label>
            </div>
          </article>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="admin-list">
          <div className="admin-list-header">
            <h2>Позиции услуг</h2>
            <Button onClick={() => setServices((current) => [createEmptyService(), ...current])}><Plus size={18} /> Добавить услугу</Button>
          </div>
          {services.map((service) => (
            <article className="admin-editor" key={service.id}>
              <div className="admin-preview" style={getMediaStyle(service.image)}><span>{service.title}</span></div>
              <div className="admin-form-grid">
                <label><span>Название</span><input value={service.title} onChange={(event) => updateService(service.id, 'title', event.target.value)} /></label>
                <label><span>Цена</span><input value={service.price} onChange={(event) => updateService(service.id, 'price', event.target.value)} /></label>
                <label><span>Длительность текстом</span><input value={service.duration} onChange={(event) => updateService(service.id, 'duration', event.target.value)} /></label>
                <label><span>Длительность, минут</span><input type="number" min="15" value={service.durationMinutes} onChange={(event) => updateService(service.id, 'durationMinutes', Number(event.target.value))} /></label>
                <label><span>Возраст текстом</span><input value={service.ageLimit} onChange={(event) => updateService(service.id, 'ageLimit', event.target.value)} /></label>
                <label><span>Минимальный возраст</span><input type="number" min="0" value={service.minAge} onChange={(event) => updateService(service.id, 'minAge', Number(event.target.value))} /></label>
                <label className="admin-wide"><span>Краткое описание</span><textarea value={service.shortDescription} onChange={(event) => updateService(service.id, 'shortDescription', event.target.value)} rows={2} /></label>
                <label className="admin-wide"><span>Подробное описание</span><textarea value={service.fullDescription} onChange={(event) => updateService(service.id, 'fullDescription', event.target.value)} rows={3} /></label>
                <label className="admin-wide"><span>Подготовка</span><textarea value={service.preparation} onChange={(event) => updateService(service.id, 'preparation', event.target.value)} rows={2} /></label>
                <label><span>Ограничения</span><textarea value={joinLines(service.restrictions)} onChange={(event) => updateService(service.id, 'restrictions', splitLines(event.target.value))} rows={4} /></label>
                <label><span>Кому подходит</span><textarea value={joinLines(service.suitableFor)} onChange={(event) => updateService(service.id, 'suitableFor', splitLines(event.target.value))} rows={4} /></label>
                <label><span>Правила безопасности</span><textarea value={joinLines(service.safetyRules)} onChange={(event) => updateService(service.id, 'safetyRules', splitLines(event.target.value))} rows={4} /></label>
                <label><span>URL изображения или CSS-gradient</span><input value={service.image} onChange={(event) => updateService(service.id, 'image', event.target.value)} /></label>
                <ImageUploadButton label="Добавить файл фото" onUpload={(dataUrl) => updateService(service.id, 'image', dataUrl)} />
                <label className="checkbox-label"><input type="checkbox" checked={service.isAvailable} onChange={(event) => updateService(service.id, 'isAvailable', event.target.checked)} /><span>Услуга доступна для записи</span></label>
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))}><Trash2 size={18} /> Удалить услугу</Button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="admin-list">
          <div className="admin-list-header"><h2>Фотографии галереи</h2><Button onClick={() => setGalleryItems((current) => [createEmptyGalleryItem(), ...current])}><Plus size={18} /> Добавить фото</Button></div>
          {galleryItems.map((item) => (
            <article className="admin-editor compact-editor" key={item.id}>
              <div className="admin-preview" style={getMediaStyle(item.image)}><span>{item.title}</span></div>
              <div className="admin-form-grid">
                <label><span>Название</span><input value={item.title} onChange={(event) => updateGalleryItem(item.id, 'title', event.target.value)} /></label>
                <label><span>Категория</span><select value={item.category} onChange={(event) => updateGalleryItem(item.id, 'category', event.target.value as GalleryItem['category'])}>{categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
                <label><span>URL изображения или CSS-gradient</span><input value={item.image} onChange={(event) => updateGalleryItem(item.id, 'image', event.target.value)} /></label>
                <ImageUploadButton label="Добавить файл фото" onUpload={(dataUrl) => updateGalleryItem(item.id, 'image', dataUrl)} />
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setGalleryItems((current) => current.filter((galleryItem) => galleryItem.id !== item.id))}><Trash2 size={18} /> Удалить фото</Button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'horses' && (
        <div className="admin-list">
          <div className="admin-list-header"><h2>Ресурсы конюшни</h2><Button onClick={() => setHorses((current) => [createEmptyHorse(services.map((service) => service.id)), ...current])}><Plus size={18} /> Добавить лошадь</Button></div>
          {horses.map((horse) => (
            <article className="admin-editor compact-editor" key={horse.id}>
              <div className="horse-admin-card">
                <div className="horse-admin-photo" style={getMediaStyle(horse.image || '')}>
                  <span>{horse.name}</span>
                </div>
                <div className="horse-admin-info">
                  <h3>{horse.name}</h3>
                  <p>{horse.description}</p>
                  <strong>До {horse.maxRiderWeightKg} кг</strong>
                </div>
              </div>
              <div className="admin-form-grid">
                <label><span>Имя</span><input value={horse.name} onChange={(event) => updateHorse(horse.id, 'name', event.target.value)} /></label>
                <label><span>Максимальный вес, кг</span><input type="number" min="1" value={horse.maxRiderWeightKg} onChange={(event) => updateHorse(horse.id, 'maxRiderWeightKg', Number(event.target.value))} /></label>
                <label><span>Статус</span><select value={horse.status} onChange={(event) => updateHorse(horse.id, 'status', event.target.value as HorseStatus)}>{horseStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                <label className="checkbox-label"><input type="checkbox" checked={horse.isActive} onChange={(event) => updateHorse(horse.id, 'isActive', event.target.checked)} /><span>Активна в записи</span></label>
                <label className="admin-wide"><span>Описание</span><textarea value={horse.description || ''} onChange={(event) => updateHorse(horse.id, 'description', event.target.value)} rows={2} /></label>
                <label><span>URL изображения или CSS-gradient</span><input value={horse.image || ''} onChange={(event) => updateHorse(horse.id, 'image', event.target.value)} /></label>
                <ImageUploadButton label="Добавить файл лошади" onUpload={(dataUrl) => updateHorse(horse.id, 'image', dataUrl)} />
                <label className="admin-wide"><span>Допустимые услуги</span><select multiple value={horse.allowedServiceIds} onChange={(event) => updateHorse(horse.id, 'allowedServiceIds', Array.from(event.target.selectedOptions).map((option) => option.value))}>{services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
                <label className="admin-wide"><span>Заметка администратора</span><textarea value={horse.notes || ''} onChange={(event) => updateHorse(horse.id, 'notes', event.target.value)} rows={2} /></label>
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setHorses((current) => current.filter((item) => item.id !== horse.id))}><Trash2 size={18} /> Удалить</Button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'trainers' && (
        <div className="admin-list">
          <div className="admin-list-header"><h2>Тренерский состав</h2><Button onClick={addTrainer}><Plus size={18} /> Добавить тренера</Button></div>
          {trainers.map((trainer) => (
            <article className="admin-editor compact-editor" key={trainer.id}>
              <div className="horse-admin-card">
                <div className="horse-admin-photo" style={getMediaStyle(trainer.photo || '')}>
                  <span>{trainer.fullName}</span>
                </div>
                <div className="horse-admin-info">
                  <h3>{trainer.fullName}</h3>
                  <p>{trainer.phone}{trainer.email ? ` · ${trainer.email}` : ''}</p>
                  <span>{trainerStatuses.find((item) => item.value === trainer.status)?.label || trainer.status}</span>
                </div>
              </div>

              <div className="admin-form-grid">
                <label><span>ФИО</span><input value={trainer.fullName} onChange={(event) => updateTrainer(trainer.id, 'fullName', event.target.value)} /></label>
                <label><span>Телефон</span><input value={trainer.phone} onChange={(event) => updateTrainer(trainer.id, 'phone', event.target.value)} /></label>
                <label><span>Email</span><input value={trainer.email || ''} onChange={(event) => updateTrainer(trainer.id, 'email', event.target.value)} /></label>
                <label><span>Статус</span><select value={trainer.status} onChange={(event) => updateTrainer(trainer.id, 'status', event.target.value as TrainerStatus)}>{trainerStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                <label className="admin-wide"><span>Описание</span><textarea value={trainer.description || ''} onChange={(event) => updateTrainer(trainer.id, 'description', event.target.value)} rows={2} /></label>
                <label><span>Начало рабочего дня</span><input type="time" value={trainer.workStartTime} onChange={(event) => updateTrainer(trainer.id, 'workStartTime', event.target.value)} /></label>
                <label><span>Конец рабочего дня</span><input type="time" value={trainer.workEndTime} onChange={(event) => updateTrainer(trainer.id, 'workEndTime', event.target.value)} /></label>
                <label><span>Рабочие дни</span><select multiple value={trainer.workingDays.map(String)} onChange={(event) => updateTrainer(trainer.id, 'workingDays', Array.from(event.target.selectedOptions).map((option) => Number(option.value)))}>{[{ value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' }, { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 0, label: 'Вс' }].map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
                <label className="admin-wide"><span>Разрешенные услуги</span><select multiple value={trainer.allowedServiceIds} onChange={(event) => updateTrainer(trainer.id, 'allowedServiceIds', Array.from(event.target.selectedOptions).map((option) => option.value))}>{services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
                <label className="checkbox-label"><input type="checkbox" checked={trainer.isActive} onChange={(event) => updateTrainer(trainer.id, 'isActive', event.target.checked)} /><span>Тренер активен для записи</span></label>
                <label className="admin-wide"><span>Заметка администратора</span><textarea value={trainer.notes || ''} onChange={(event) => updateTrainer(trainer.id, 'notes', event.target.value)} rows={2} /></label>
                <label><span>Фото (URL или CSS)</span><input value={trainer.photo || ''} onChange={(event) => updateTrainer(trainer.id, 'photo', event.target.value)} /></label>
                <ImageUploadButton label="Добавить файл фото тренера" onUpload={(dataUrl) => updateTrainer(trainer.id, 'photo', dataUrl)} />
              </div>

              <Button variant="ghost" className="danger-button" onClick={() => deleteTrainer(trainer.id)}><Trash2 size={18} /> Удалить тренера</Button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="admin-list">
          <div className="admin-list-header">
            <div>
              <h2>Доступы сотрудников и уведомления</h2>
              <p className="form-note">Пароли в демо-версии сохраняются в браузере. В реальном backend их нужно хранить только в виде хешей.</p>
            </div>
            <Button variant="secondary" onClick={() => void handleEnableBrowserNotifications()}>
              Разрешить уведомления браузера
            </Button>
          </div>

          {staffAccounts.map((account) => {
            const linkedTrainer = account.trainerId ? trainerById.get(account.trainerId) : undefined;
            const displayName = linkedTrainer?.fullName || account.displayName;
            const settings = account.notificationSettings;
            const notificationsAvailable = account.role !== 'trainer';

            return (
              <article className="admin-editor compact-editor" key={account.id}>
                <div className="horse-admin-card">
                  <div className="horse-admin-info">
                    <h3>{displayName}</h3>
                    <p>{staffRoleLabels[account.role]}</p>
                    <span>{account.role === 'trainer' ? 'Вход через выбор тренера' : `Логин: ${account.login}`}</span>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    <span>Логин</span>
                    <input
                      value={account.login}
                      disabled={account.role === 'trainer'}
                      onChange={(event) => updateStaffAccount(account.id, 'login', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{env.useMockApi ? 'Пароль' : 'Новый пароль'}</span>
                    <input
                      type="password"
                      value={account.password}
                      placeholder={env.useMockApi ? undefined : 'Оставьте пустым, чтобы не менять'}
                      onChange={(event) => updateStaffAccount(account.id, 'password', event.target.value)}
                    />
                  </label>
                  {notificationsAvailable ? (
                    <>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.inApp}
                          onChange={(event) => updateStaffNotification(account.id, 'inApp', event.target.checked)}
                        />
                        <span>Показывать в центре уведомлений</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.browser}
                          onChange={(event) => updateStaffNotification(account.id, 'browser', event.target.checked)}
                        />
                        <span>Показывать уведомления браузера</span>
                      </label>
                      <label>
                        <span>Email для уведомлений</span>
                        <input
                          value={settings.email || ''}
                          onChange={(event) => updateStaffNotification(account.id, 'email', event.target.value)}
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.emailEnabled}
                          onChange={(event) => updateStaffNotification(account.id, 'emailEnabled', event.target.checked)}
                        />
                        <span>Email включен после backend-интеграции</span>
                      </label>
                      <label>
                        <span>Telegram</span>
                        <input
                          value={settings.telegram || ''}
                          onChange={(event) => updateStaffNotification(account.id, 'telegram', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>WhatsApp/телефон</span>
                        <input
                          value={settings.whatsapp || ''}
                          onChange={(event) => updateStaffNotification(account.id, 'whatsapp', event.target.value)}
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.telegramEnabled}
                          onChange={(event) => updateStaffNotification(account.id, 'telegramEnabled', event.target.checked)}
                        />
                        <span>Telegram включен после backend-интеграции</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={settings.whatsappEnabled}
                          onChange={(event) => updateStaffNotification(account.id, 'whatsappEnabled', event.target.checked)}
                        />
                        <span>WhatsApp включен после backend-интеграции</span>
                      </label>
                    </>
                  ) : (
                    <div className="state-box admin-wide">
                      У тренера уведомления отключены: актуальные занятия отображаются в расписании на день и неделю.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="admin-list">
          <div className="admin-list-header">
            <h2>Календарь бронирования</h2>
            <div className="calendar-controls">
              <label><span>Дата</span><input type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value || todayIso())} /></label>
              <label><span>Слоты для услуги</span><select value={calendarServiceId} onChange={(event) => setCalendarServiceId(event.target.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
            </div>
          </div>

          <div className="admin-calendar-grid">
            <section className="side-panel">
              <h3>Слоты дня</h3>
              <div className="slot-grid compact-slots">
                {previewSlots.map((slot) => (
                  <div className={`slot-choice ${slot.isAvailable ? '' : 'disabled'}`} key={slot.id}>
                    <strong>{slot.startTime}-{slot.endTime}</strong>
                    <span>{slot.isAvailable ? `Доступно лошадей: ${slot.availableHorseIds.length}` : slot.reasons[0]}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-list">
              {dayBookings.length === 0 && <div className="state-box">На выбранную дату заявок нет.</div>}
              {dayBookings.map((booking) => {
                const request = {
                  clientName: booking.clientName,
                  clientPhone: booking.clientPhone,
                  serviceId: booking.serviceId,
                  date: booking.date,
                  timeSlotId: `${booking.date}_${booking.startTime}`,
                  participants: booking.participants,
                  comment: booking.comment,
                  personalDataAgreement: true,
                };
                const conflicts = checkBookingAvailability(request).reasons;
                return (
                  <article className="booking-admin-card" key={booking.id}>
                    <div>
                      <h3>{booking.startTime}-{booking.endTime} · {serviceById.get(booking.serviceId)?.title || booking.serviceId}</h3>
                      <p>{booking.clientName} · {booking.clientPhone}</p>
                      <span className={`status-pill status-${booking.status}`}>{bookingStatuses.find((item) => item.value === booking.status)?.label}</span>
                    </div>
                    {conflicts.length > 0 && (
                      <div className="conflict-box"><AlertTriangle size={18} /> {conflicts[0]}</div>
                    )}
                    <div className="participants-list">
                      {booking.participants.map((participant) => (
                        <div className="booking-participant-row" key={participant.id}>
                          <strong>{participant.fullName}</strong>
                          <span>{participant.age} лет · {participant.weightKg} кг</span>
                          <select
                            value={booking.assignedHorses.find((assignment) => assignment.participantId === participant.id)?.horseId || ''}
                            onChange={(event) => {
                              const nextAssignments = booking.assignedHorses.filter((assignment) => assignment.participantId !== participant.id);
                              updateBooking(booking.id, 'assignedHorses', [...nextAssignments, { participantId: participant.id, horseId: event.target.value }]);
                            }}
                          >
                            <option value="">Назначить лошадь</option>
                            {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="form-grid">
                      <label>
                        <span>Назначенный тренер</span>
                        <select
                          value={booking.assignedTrainerId || ''}
                          onChange={(event) => {
                            void handleAssignTrainer(booking.id, event.target.value);
                          }}
                        >
                          <option value="">Не назначен</option>
                          {trainers
                            .filter((trainer) => trainer.isActive && trainer.allowedServiceIds.includes(booking.serviceId))
                            .map((trainer) => (
                              <option key={trainer.id} value={trainer.id}>
                                {trainer.fullName}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        <span>Статус тренера</span>
                        <select
                          value={booking.trainerStatus || 'notified'}
                          onChange={(event) => {
                            void handleTrainerStatusChange(booking.id, event.target.value as Booking['trainerStatus']);
                          }}
                          disabled={!booking.assignedTrainerId}
                        >
                          <option value="notified">Уведомлен</option>
                          <option value="seen">Ознакомился</option>
                          <option value="accepted">Подтвердил</option>
                          <option value="needs_clarification">Нужно уточнение</option>
                          <option value="completed">Проведено</option>
                        </select>
                      </label>
                    </div>
                    {booking.assignedTrainerId && (
                      <p>
                        Тренер: {trainerById.get(booking.assignedTrainerId)?.fullName || booking.assignedTrainerId}
                      </p>
                    )}
                    <div className="form-grid">
                      <label><span>Статус</span><select value={booking.status} onChange={(event) => updateBooking(booking.id, 'status', event.target.value as BookingStatus)}>{bookingStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                      <label><span>Время начала</span><input value={booking.startTime} onChange={(event) => updateBooking(booking.id, 'startTime', event.target.value)} /></label>
                      <label className="admin-wide"><span>Комментарий администратора</span><textarea value={booking.adminComment || ''} onChange={(event) => updateBooking(booking.id, 'adminComment', event.target.value)} rows={2} /></label>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="admin-list admin-content-list">
          <div className="admin-list-header">
            <h2>Контент: контакты, отзывы, правила и FAQ</h2>
            <Button variant="secondary" onClick={() => { saveEditableContacts(contacts); setSavedMessage('Контакты сохранены.'); window.setTimeout(() => setSavedMessage(''), 2500); }}>
              <Save size={18} /> Сохранить контакты
            </Button>
          </div>

          <article className="admin-editor">
            <h3>Контакты</h3>
            <div className="admin-form-grid">
              <label className="admin-wide"><span>Адрес</span><input value={contacts.address} onChange={(event) => setContacts((current) => ({ ...current, address: event.target.value }))} /></label>
              <label><span>Телефон</span><input value={contacts.phone} onChange={(event) => setContacts((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label><span>Email</span><input value={contacts.email} onChange={(event) => setContacts((current) => ({ ...current, email: event.target.value }))} /></label>
              <label className="admin-wide"><span>Режим обработки заявок</span><input value={contacts.requestSchedule} onChange={(event) => setContacts((current) => ({ ...current, requestSchedule: event.target.value }))} /></label>
            </div>

            <div className="admin-list-header">
              <h4>Мессенджеры</h4>
              <Button
                variant="secondary"
                onClick={() =>
                  setContacts((current) => ({
                    ...current,
                    messengers: [{ title: 'Новый мессенджер', url: 'https://', }, ...current.messengers],
                  }))
                }
              >
                <Plus size={18} /> Добавить
              </Button>
            </div>
            {contacts.messengers.map((link, index) => (
              <article className="admin-editor compact-editor" key={`${link.title}-${index}`}>
                <div className="admin-form-grid">
                  <label><span>Название</span><input value={link.title} onChange={(event) => setContacts((current) => ({ ...current, messengers: current.messengers.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)) }))} /></label>
                  <label><span>URL</span><input value={link.url} onChange={(event) => setContacts((current) => ({ ...current, messengers: current.messengers.map((item, itemIndex) => (itemIndex === index ? { ...item, url: event.target.value } : item)) }))} /></label>
                </div>
                <div className="admin-actions">
                  <Button variant="ghost" disabled={index === 0} onClick={() => setContacts((current) => ({ ...current, messengers: swapByDirection(current.messengers, index, -1) }))}><ArrowUp size={18} /> Вверх</Button>
                  <Button variant="ghost" disabled={index === contacts.messengers.length - 1} onClick={() => setContacts((current) => ({ ...current, messengers: swapByDirection(current.messengers, index, 1) }))}><ArrowDown size={18} /> Вниз</Button>
                  <Button variant="ghost" className="danger-button" onClick={() => setContacts((current) => ({ ...current, messengers: current.messengers.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={18} /> Удалить</Button>
                </div>
              </article>
            ))}

            <div className="admin-list-header">
              <h4>Социальные сети</h4>
              <Button
                variant="secondary"
                onClick={() =>
                  setContacts((current) => ({
                    ...current,
                    socialLinks: [{ title: 'Новая сеть', url: 'https://', }, ...current.socialLinks],
                  }))
                }
              >
                <Plus size={18} /> Добавить
              </Button>
            </div>
            {contacts.socialLinks.map((link, index) => (
              <article className="admin-editor compact-editor" key={`${link.title}-${index}`}>
                <div className="admin-form-grid">
                  <label><span>Название</span><input value={link.title} onChange={(event) => setContacts((current) => ({ ...current, socialLinks: current.socialLinks.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)) }))} /></label>
                  <label><span>URL</span><input value={link.url} onChange={(event) => setContacts((current) => ({ ...current, socialLinks: current.socialLinks.map((item, itemIndex) => (itemIndex === index ? { ...item, url: event.target.value } : item)) }))} /></label>
                </div>
                <div className="admin-actions">
                  <Button variant="ghost" disabled={index === 0} onClick={() => setContacts((current) => ({ ...current, socialLinks: swapByDirection(current.socialLinks, index, -1) }))}><ArrowUp size={18} /> Вверх</Button>
                  <Button variant="ghost" disabled={index === contacts.socialLinks.length - 1} onClick={() => setContacts((current) => ({ ...current, socialLinks: swapByDirection(current.socialLinks, index, 1) }))}><ArrowDown size={18} /> Вниз</Button>
                  <Button variant="ghost" className="danger-button" onClick={() => setContacts((current) => ({ ...current, socialLinks: current.socialLinks.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={18} /> Удалить</Button>
                </div>
              </article>
            ))}
          </article>

          <div className="admin-list-header">
            <h3>Отзывы</h3>
            <div className="admin-actions">
              <Button variant="secondary" onClick={() => { saveEditableReviews(reviews); setSavedMessage('Отзывы сохранены.'); window.setTimeout(() => setSavedMessage(''), 2500); }}>
                <Save size={18} /> Сохранить отзывы
              </Button>
              <Button onClick={() => setReviews((current) => [{ id: `review-${Date.now()}`, clientName: 'Новый клиент', text: 'Новый отзыв', date: new Date().toLocaleDateString('ru-RU'), rating: 5 }, ...current])}>
                <Plus size={18} /> Добавить отзыв
              </Button>
            </div>
          </div>
          {reviews.map((review, index) => (
            <article className="admin-editor compact-editor" key={review.id}>
              <div className="admin-form-grid">
                <label><span>Имя</span><input value={review.clientName} onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, clientName: event.target.value } : item)))} /></label>
                <label><span>Дата</span><input value={review.date} onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, date: event.target.value } : item)))} /></label>
                <label><span>Оценка</span><input type="number" min="1" max="5" value={review.rating} onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, rating: Number(event.target.value) } : item)))} /></label>
                <label className="admin-wide"><span>Текст</span><textarea rows={3} value={review.text} onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, text: event.target.value } : item)))} /></label>
              </div>
              <div className="admin-actions">
                <Button variant="ghost" disabled={index === 0} onClick={() => setReviews((current) => swapByDirection(current, index, -1))}><ArrowUp size={18} /> Вверх</Button>
                <Button variant="ghost" disabled={index === reviews.length - 1} onClick={() => setReviews((current) => swapByDirection(current, index, 1))}><ArrowDown size={18} /> Вниз</Button>
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setReviews((current) => current.filter((item) => item.id !== review.id))}><Trash2 size={18} /> Удалить отзыв</Button>
            </article>
          ))}

          <div className="admin-list-header">
            <h3>Разделы правил</h3>
            <div className="admin-actions">
              <Button variant="secondary" onClick={() => { saveEditableRulesInfo(rulesInfo); setSavedMessage('Правила и FAQ сохранены.'); window.setTimeout(() => setSavedMessage(''), 2500); }}>
                <Save size={18} /> Сохранить правила и FAQ
              </Button>
              <Button onClick={() => setRulesInfo((current) => ({ ...current, sections: [{ id: `section-${Date.now()}`, title: 'Новый раздел', items: ['Новый пункт'] }, ...current.sections] }))}>
                <Plus size={18} /> Добавить раздел
              </Button>
            </div>
          </div>
          {rulesInfo.sections.map((section, index) => (
            <article className="admin-editor compact-editor" key={section.id}>
              <div className="admin-form-grid">
                <label><span>Заголовок раздела</span><input value={section.title} onChange={(event) => setRulesInfo((current) => ({ ...current, sections: current.sections.map((item) => (item.id === section.id ? { ...item, title: event.target.value } : item)) }))} /></label>
                <label className="admin-wide"><span>Пункты (с новой строки)</span><textarea rows={4} value={section.items.join('\n')} onChange={(event) => setRulesInfo((current) => ({ ...current, sections: current.sections.map((item) => (item.id === section.id ? { ...item, items: splitLines(event.target.value) } : item)) }))} /></label>
              </div>
              <div className="admin-actions">
                <Button variant="ghost" disabled={index === 0} onClick={() => setRulesInfo((current) => ({ ...current, sections: swapByDirection(current.sections, index, -1) }))}><ArrowUp size={18} /> Вверх</Button>
                <Button variant="ghost" disabled={index === rulesInfo.sections.length - 1} onClick={() => setRulesInfo((current) => ({ ...current, sections: swapByDirection(current.sections, index, 1) }))}><ArrowDown size={18} /> Вниз</Button>
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setRulesInfo((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) }))}><Trash2 size={18} /> Удалить раздел</Button>
            </article>
          ))}

          <div className="admin-list-header">
            <h3>FAQ</h3>
            <Button onClick={() => setRulesInfo((current) => ({ ...current, faq: [{ id: `faq-${Date.now()}`, question: 'Новый вопрос', answer: 'Новый ответ' }, ...current.faq] }))}>
              <Plus size={18} /> Добавить FAQ
            </Button>
          </div>
          {rulesInfo.faq.map((item, index) => (
            <article className="admin-editor compact-editor" key={item.id}>
              <div className="admin-form-grid">
                <label className="admin-wide"><span>Вопрос</span><input value={item.question} onChange={(event) => setRulesInfo((current) => ({ ...current, faq: current.faq.map((faqItem) => (faqItem.id === item.id ? { ...faqItem, question: event.target.value } : faqItem)) }))} /></label>
                <label className="admin-wide"><span>Ответ</span><textarea rows={3} value={item.answer} onChange={(event) => setRulesInfo((current) => ({ ...current, faq: current.faq.map((faqItem) => (faqItem.id === item.id ? { ...faqItem, answer: event.target.value } : faqItem)) }))} /></label>
              </div>
              <div className="admin-actions">
                <Button variant="ghost" disabled={index === 0} onClick={() => setRulesInfo((current) => ({ ...current, faq: swapByDirection(current.faq, index, -1) }))}><ArrowUp size={18} /> Вверх</Button>
                <Button variant="ghost" disabled={index === rulesInfo.faq.length - 1} onClick={() => setRulesInfo((current) => ({ ...current, faq: swapByDirection(current.faq, index, 1) }))}><ArrowDown size={18} /> Вниз</Button>
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setRulesInfo((current) => ({ ...current, faq: current.faq.filter((faqItem) => faqItem.id !== item.id) }))}><Trash2 size={18} /> Удалить FAQ</Button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="admin-list">
          <div className="admin-list-header"><h2>Правила записи и исключения</h2><Button onClick={() => setBookingRules((current) => [createEmptyBookingRule(), ...current])}><Plus size={18} /> Добавить правило</Button></div>
          {bookingRules.map((rule) => (
            <article className="admin-editor compact-editor" key={rule.id}>
              <div className="rule-admin-card">
                <h3>{rule.name}</h3>
                <p>{ruleTypes.find((item) => item.value === rule.type)?.label}</p>
                <span>{rule.isActive ? 'Активно' : 'Выключено'}</span>
              </div>
              <div className="admin-form-grid">
                <label><span>Название</span><input value={rule.name} onChange={(event) => updateBookingRule(rule.id, 'name', event.target.value)} /></label>
                <label><span>Тип</span><select value={rule.type} onChange={(event) => changeBookingRuleType(rule.id, event.target.value as BookingRuleType)}>{ruleTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                <label className="checkbox-label"><input type="checkbox" checked={rule.isActive} onChange={(event) => updateBookingRule(rule.id, 'isActive', event.target.checked)} /><span>Правило активно</span></label>
                {renderBookingRuleConfig(rule)}
              </div>
              <Button variant="ghost" className="danger-button" onClick={() => setBookingRules((current) => current.filter((item) => item.id !== rule.id))}><Trash2 size={18} /> Удалить правило</Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
