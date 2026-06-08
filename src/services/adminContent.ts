import type { Booking, BookingRule, ContactInfo, GalleryItem, Horse, Review, RulesInfo, Service, SiteContent, Trainer } from '../types';
import { getSiteContent, loginStaff, logoutStaff, type AdminSnapshot } from './backendApi';

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

const LEGACY_LOCAL_STORAGE_KEYS = [
  SERVICES_KEY,
  GALLERY_KEY,
  HORSES_KEY,
  TRAINERS_KEY,
  BOOKINGS_KEY,
  BOOKING_RULES_KEY,
  SITE_CONTENT_KEY,
  REVIEWS_KEY,
  CONTACTS_KEY,
  RULES_INFO_KEY,
  'orlov_staff_accounts',
  'orlov_notifications',
  'orlov_content_blocks',
  'orlov_media_assets',
  'orlov_media_folders',
  'orlov_content_revisions',
  'orlov_browser_notified_ids',
];

const fallbackSiteContent: SiteContent = {
  siteName: 'КТК "Сивка-Бурка"',
  siteSubtitle: 'конно-спортивный клуб',
  homeEyebrow: 'г. Гурьевск · КТК "Сивка-Бурка"',
  homeHeroTitle: 'Конно-спортивные услуги для обучения, отдыха и семейного досуга',
  homeHeroText: 'Выберите подходящий формат занятия и оставьте предварительную заявку.',
  homeHeroImage: 'linear-gradient(135deg, #24482d 0%, #7b5b38 48%, #d9bd89 100%)',
  homeHeroImagePosition: 'center',
  primaryColor: '#1f4a2a',
  darkColor: '#14351f',
  accentColor: '#a86f45',
  popularServicesTitle: 'Популярные направления',
  popularServicesText: 'Каталог услуг загружается из базы данных.',
  trustTitle: 'Важно перед посещением',
  trustText: 'Перед занятием проводится инструктаж, а формат подбирается под возраст и подготовку клиента.',
  reviewsTitle: 'Отзывы клиентов',
  pageCopies: {
    services: { eyebrow: 'Каталог', title: 'Услуги конно-спортивного клуба', text: 'Выберите формат и оставьте предварительную заявку.' },
    booking: { eyebrow: 'Запись', title: 'Предварительная заявка на занятие', text: 'Заполните форму, и администратор свяжется с вами для подтверждения времени.' },
    rules: { eyebrow: 'Правила', title: 'Безопасность и подготовка к посещению', text: 'Короткие требования, которые помогают сделать занятие спокойным и предсказуемым.' },
    gallery: { eyebrow: 'Галерея', title: 'Фотографии занятий, прогулок и территории', text: 'Разделы оформлены как альбомы.' },
    reviews: { eyebrow: 'Отзывы', title: 'Что говорят клиенты', text: 'Отзывы клиентов клуба.' },
    contacts: { eyebrow: 'Контакты', title: 'Связь и адрес предприятия', text: 'Оставить заявку можно через форму, а уточнить детали - по телефону.' },
  },
};

const fallbackContacts: ContactInfo = {
  address: '',
  phone: '',
  email: '',
  requestSchedule: '',
  messengers: [],
  socialLinks: [],
};

const fallbackRulesInfo: RulesInfo = {
  sections: [],
  faq: [],
};

let editableState = {
  siteContent: fallbackSiteContent,
  services: [] as Service[],
  galleryItems: [] as GalleryItem[],
  horses: [] as Horse[],
  trainers: [] as Trainer[],
  bookings: [] as Booking[],
  bookingRules: [] as BookingRule[],
  reviews: [] as Review[],
  contacts: fallbackContacts,
  rulesInfo: fallbackRulesInfo,
};

function emitContentUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('orlov-content-updated'));
}

function normalizeSiteContent(content: SiteContent): SiteContent {
  return {
    ...fallbackSiteContent,
    ...content,
    pageCopies: {
      ...fallbackSiteContent.pageCopies,
      ...(content.pageCopies || {}),
    },
  };
}

function normalizeService(service: Service): Service {
  return {
    ...service,
    durationMinutes: service.durationMinutes || 60,
    minAge: typeof service.minAge === 'number' ? service.minAge : 7,
  };
}

export function clearLegacyBrowserData() {
  if (typeof window === 'undefined') return;
  LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function applyEditableSnapshot(snapshot: AdminSnapshot) {
  editableState = {
    siteContent: normalizeSiteContent(snapshot.siteContent),
    services: snapshot.services.map(normalizeService),
    galleryItems: clone(snapshot.galleryItems),
    horses: clone(snapshot.horses),
    trainers: clone(snapshot.trainers),
    bookings: clone(snapshot.bookings),
    bookingRules: clone(snapshot.bookingRules),
    reviews: clone(snapshot.reviews),
    contacts: clone(snapshot.contacts),
    rulesInfo: clone(snapshot.rulesInfo),
  };
  emitContentUpdated();
}

export async function hydrateEditableContentFromBackend() {
  const response = await getSiteContent();
  editableState = {
    ...editableState,
    siteContent: normalizeSiteContent(response.data),
  };
  emitContentUpdated();
  return editableState.siteContent;
}

export function getEditableServices(): Service[] {
  return clone(editableState.services).map(normalizeService);
}

export function getEditableSiteContent(): SiteContent {
  return clone(editableState.siteContent);
}

export function saveEditableSiteContent(content: SiteContent) {
  editableState = { ...editableState, siteContent: normalizeSiteContent(content) };
  emitContentUpdated();
}

export function saveEditableServices(items: Service[]) {
  editableState = { ...editableState, services: items.map(normalizeService) };
  emitContentUpdated();
}

export function getEditableGalleryItems(): GalleryItem[] {
  return clone(editableState.galleryItems);
}

export function saveEditableGalleryItems(items: GalleryItem[]) {
  editableState = { ...editableState, galleryItems: clone(items) };
  emitContentUpdated();
}

export function getEditableHorses(): Horse[] {
  return clone(editableState.horses).map((horse) => ({
    ...horse,
    image: horse.image || 'linear-gradient(135deg, #3d2c1f, #b58a5a)',
  }));
}

export function saveEditableHorses(items: Horse[]) {
  editableState = { ...editableState, horses: clone(items) };
  emitContentUpdated();
}

export function getEditableTrainers(): Trainer[] {
  return clone(editableState.trainers);
}

export function saveEditableTrainers(items: Trainer[]) {
  editableState = { ...editableState, trainers: clone(items) };
  emitContentUpdated();
}

export function getEditableBookings(): Booking[] {
  return clone(editableState.bookings);
}

export function saveEditableBookings(items: Booking[]) {
  editableState = { ...editableState, bookings: clone(items) };
  emitContentUpdated();
}

export function getEditableBookingRules(): BookingRule[] {
  return clone(editableState.bookingRules);
}

export function saveEditableBookingRules(items: BookingRule[]) {
  editableState = { ...editableState, bookingRules: clone(items) };
  emitContentUpdated();
}

export function getEditableReviews(): Review[] {
  return clone(editableState.reviews);
}

export function saveEditableReviews(items: Review[]) {
  editableState = { ...editableState, reviews: clone(items) };
  emitContentUpdated();
}

export function getEditableContacts(): ContactInfo {
  return clone(editableState.contacts);
}

export function saveEditableContacts(value: ContactInfo) {
  editableState = { ...editableState, contacts: clone(value) };
  emitContentUpdated();
}

export function getEditableRulesInfo(): RulesInfo {
  return clone(editableState.rulesInfo);
}

export function saveEditableRulesInfo(value: RulesInfo) {
  editableState = { ...editableState, rulesInfo: clone(value) };
  emitContentUpdated();
}

export function resetEditableContent() {
  clearLegacyBrowserData();
  editableState = {
    siteContent: fallbackSiteContent,
    services: [],
    galleryItems: [],
    horses: [],
    trainers: [],
    bookings: [],
    bookingRules: [],
    reviews: [],
    contacts: fallbackContacts,
    rulesInfo: fallbackRulesInfo,
  };
  emitContentUpdated();
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

export function logoutAdmin() {
  void logoutStaff().catch(() => undefined);
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
