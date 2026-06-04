import {
  bookingRules as initialBookingRules,
  bookings as initialBookings,
  contacts as initialContacts,
  reviews as initialReviews,
  rulesInfo as initialRulesInfo,
  galleryItems as initialGalleryItems,
  horses as initialHorses,
  trainers as initialTrainers,
  services as initialServices,
  siteContent as initialSiteContent,
} from '../data/mockData';
import type { Booking, BookingRule, ContactInfo, GalleryItem, Horse, Review, RulesInfo, Service, SiteContent, Trainer } from '../types';
import { loginStaff, logoutStaff } from './backendApi';
import { env } from './env';
import { resetStaffAccounts, verifyAdminCredentials } from './staffSettings';

const SERVICES_KEY = 'orlov_admin_services';
const GALLERY_KEY = 'orlov_admin_gallery';
const HORSES_KEY = 'orlov_admin_horses';
const TRAINERS_KEY = 'orlov_admin_trainers';
const BOOKINGS_KEY = 'orlov_admin_bookings';
const BOOKING_RULES_KEY = 'orlov_admin_booking_rules';
const SITE_CONTENT_KEY = 'orlov_admin_site_content';
const REVIEWS_KEY = 'orlov_admin_reviews';
const CONTACTS_KEY = 'orlov_admin_contacts';
const RULES_INFO_KEY = 'orlov_admin_rules_info';
const SESSION_KEY = 'orlov_admin_session';
const EDIT_MODE_KEY = 'orlov_admin_edit_mode';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readStorage<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return clone(fallback);

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return clone(fallback);
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeService(service: Service): Service {
  return {
    ...service,
    durationMinutes: service.durationMinutes || 60,
    minAge: typeof service.minAge === 'number' ? service.minAge : 7,
  };
}

export function getEditableServices(): Service[] {
  return readStorage<Service[]>(SERVICES_KEY, initialServices).map(normalizeService);
}

export function getEditableSiteContent(): SiteContent {
  const savedContent = readStorage<Partial<SiteContent>>(SITE_CONTENT_KEY, initialSiteContent);
  const migratedContent = { ...savedContent };
  if (migratedContent.siteName === 'ИП Орлова Н.И.') migratedContent.siteName = initialSiteContent.siteName;
  if (migratedContent.siteSubtitle === 'конно-спортивные услуги') migratedContent.siteSubtitle = initialSiteContent.siteSubtitle;
  if (migratedContent.homeEyebrow === 'г. Гурьевск · ИП Орлова Н.И.') migratedContent.homeEyebrow = initialSiteContent.homeEyebrow;
  return {
    ...initialSiteContent,
    ...migratedContent,
    pageCopies: {
      ...initialSiteContent.pageCopies,
      ...(migratedContent.pageCopies || {}),
    },
  };
}

export function saveEditableSiteContent(content: SiteContent) {
  writeStorage(SITE_CONTENT_KEY, content);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function saveEditableServices(items: Service[]) {
  writeStorage(SERVICES_KEY, items.map(normalizeService));
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableGalleryItems(): GalleryItem[] {
  return readStorage(GALLERY_KEY, initialGalleryItems);
}

export function saveEditableGalleryItems(items: GalleryItem[]) {
  writeStorage(GALLERY_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableHorses(): Horse[] {
  return readStorage<Horse[]>(HORSES_KEY, initialHorses).map((horse) => ({
    ...horse,
    image: horse.image || 'linear-gradient(135deg, #3d2c1f, #b58a5a)',
  }));
}

export function saveEditableHorses(items: Horse[]) {
  writeStorage(HORSES_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableTrainers(): Trainer[] {
  return readStorage<Trainer[]>(TRAINERS_KEY, initialTrainers);
}

export function saveEditableTrainers(items: Trainer[]) {
  writeStorage(TRAINERS_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableBookings(): Booking[] {
  return readStorage(BOOKINGS_KEY, initialBookings);
}

export function saveEditableBookings(items: Booking[]) {
  writeStorage(BOOKINGS_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableBookingRules(): BookingRule[] {
  return readStorage(BOOKING_RULES_KEY, initialBookingRules);
}

export function saveEditableBookingRules(items: BookingRule[]) {
  writeStorage(BOOKING_RULES_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableReviews(): Review[] {
  return readStorage<Review[]>(REVIEWS_KEY, initialReviews);
}

export function saveEditableReviews(items: Review[]) {
  writeStorage(REVIEWS_KEY, items);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableContacts(): ContactInfo {
  const contacts = readStorage<ContactInfo>(CONTACTS_KEY, initialContacts);
  if (contacts.address === 'г. Гурьевск, территория конно-спортивного клуба ИП Орлова Н.И.') {
    return { ...contacts, address: initialContacts.address };
  }
  return contacts;
}

export function saveEditableContacts(value: ContactInfo) {
  writeStorage(CONTACTS_KEY, value);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function getEditableRulesInfo(): RulesInfo {
  return readStorage<RulesInfo>(RULES_INFO_KEY, initialRulesInfo);
}

export function saveEditableRulesInfo(value: RulesInfo) {
  writeStorage(RULES_INFO_KEY, value);
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function resetEditableContent() {
  window.localStorage.removeItem(SERVICES_KEY);
  window.localStorage.removeItem(GALLERY_KEY);
  window.localStorage.removeItem(HORSES_KEY);
  window.localStorage.removeItem(TRAINERS_KEY);
  window.localStorage.removeItem(BOOKINGS_KEY);
  window.localStorage.removeItem(BOOKING_RULES_KEY);
  window.localStorage.removeItem(SITE_CONTENT_KEY);
  window.localStorage.removeItem(REVIEWS_KEY);
  window.localStorage.removeItem(CONTACTS_KEY);
  window.localStorage.removeItem(RULES_INFO_KEY);
  resetStaffAccounts();
  window.dispatchEvent(new Event('orlov-content-updated'));
}

export function isAdminAuthorized() {
  return window.sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function isAdminEditMode() {
  return window.sessionStorage.getItem(EDIT_MODE_KEY) === 'true';
}

export function setAdminEditMode(enabled: boolean) {
  if (enabled) {
    window.sessionStorage.setItem(EDIT_MODE_KEY, 'true');
  } else {
    window.sessionStorage.removeItem(EDIT_MODE_KEY);
  }
  window.dispatchEvent(new Event('orlov-admin-state-updated'));
}

export async function loginAdmin(login: string, password: string) {
  if (!env.useMockApi) {
    try {
      const response = await loginStaff({ role: 'admin', login, password });
      if (response.data.role !== 'admin') return false;
      window.sessionStorage.setItem(SESSION_KEY, 'true');
      window.dispatchEvent(new Event('orlov-admin-state-updated'));
      return true;
    } catch {
      return false;
    }
  }

  const success = verifyAdminCredentials(login, password);
  if (success) {
    window.sessionStorage.setItem(SESSION_KEY, 'true');
    window.dispatchEvent(new Event('orlov-admin-state-updated'));
  }
  return success;
}

export function logoutAdmin() {
  if (!env.useMockApi) void logoutStaff().catch(() => undefined);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(EDIT_MODE_KEY);
  window.dispatchEvent(new Event('orlov-admin-state-updated'));
}

export function createEmptyService(): Service {
  return {
    id: `service-${Date.now()}`,
    title: 'Новая услуга',
    shortDescription: 'Краткое описание услуги.',
    fullDescription: 'Подробное описание услуги, условия проведения и особенности формата.',
    duration: '60 минут',
    durationMinutes: 60,
    price: 'по согласованию',
    image: 'linear-gradient(135deg, #315734, #b67f4a)',
    ageLimit: 'по согласованию',
    minAge: 7,
    preparation: 'Уточняется администратором перед подтверждением заявки.',
    restrictions: ['Требуется предварительное согласование'],
    suitableFor: ['Клиенты, которым подходит индивидуальный формат'],
    safetyRules: ['Перед началом проводится инструктаж'],
    isAvailable: true,
  };
}

export function createEmptyGalleryItem(): GalleryItem {
  return {
    id: `gallery-${Date.now()}`,
    title: 'Новая фотография',
    category: 'lessons',
    image: 'linear-gradient(135deg, #264b32, #b78655)',
  };
}

export function createEmptyHorse(serviceIds: string[]): Horse {
  return {
    id: `horse-${Date.now()}`,
    name: 'Новая лошадь',
    description: 'Краткое описание характера и подходящих занятий.',
    image: 'linear-gradient(135deg, #3d2c1f, #b58a5a)',
    maxRiderWeightKg: 80,
    allowedServiceIds: serviceIds.slice(0, 2),
    status: 'available',
    isActive: true,
    notes: '',
  };
}

export function createEmptyTrainer(serviceIds: string[]): Trainer {
  return {
    id: `trainer-${Date.now()}`,
    fullName: 'Новый тренер',
    phone: '+7 ',
    email: '',
    photo: 'linear-gradient(135deg, #274733, #b58857)',
    description: 'Краткое описание тренера.',
    allowedServiceIds: serviceIds.slice(0, 2),
    status: 'active',
    isActive: true,
    workingDays: [1, 2, 3, 4, 5],
    workStartTime: '10:00',
    workEndTime: '18:00',
    notes: '',
  };
}

export function createEmptyBookingRule(): BookingRule {
  return {
    id: `rule-${Date.now()}`,
    name: 'Новое правило',
    type: 'custom_exception',
    isActive: true,
    config: {
      description: 'Описание условия для будущей серверной проверки',
    },
  };
}
