export interface Service {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  duration: string;
  durationMinutes: number;
  price: string;
  image: string;
  ageLimit: string;
  minAge: number;
  preparation: string;
  restrictions: string[];
  suitableFor: string[];
  safetyRules: string[];
  isAvailable: boolean;
}

export type RiderExperience = 'beginner' | 'experienced' | 'confident';

export interface BookingParticipant {
  id: string;
  fullName: string;
  age: number;
  weightKg: number;
  experience: RiderExperience;
  comment?: string;
}

export interface BookingRequest {
  clientName: string;
  clientPhone: string;
  serviceId: string;
  date: string;
  timeSlotId: string;
  participants: BookingParticipant[];
  comment?: string;
  personalDataAgreement: boolean;
}

export type FormStatus = 'idle' | 'loading' | 'success' | 'error';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'needs_clarification' | 'cancelled';
export type HorseStatus = 'available' | 'unavailable' | 'rest' | 'treatment' | 'busy';

export interface Horse {
  id: string;
  name: string;
  description?: string;
  image?: string;
  maxRiderWeightKg: number;
  allowedServiceIds: string[];
  status: HorseStatus;
  isActive: boolean;
  notes?: string;
}

export type UserRole = 'admin' | 'manager' | 'trainer';

export type TrainerStatus = 'active' | 'unavailable' | 'vacation' | 'sick_leave';

export interface Trainer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  photo?: string;
  description?: string;
  allowedServiceIds: string[];
  status: TrainerStatus;
  isActive: boolean;
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
  notes?: string;
}

export type TrainerBookingStatus =
  | 'notified'
  | 'seen'
  | 'accepted'
  | 'needs_clarification'
  | 'completed';

export interface TrainerAssignment {
  bookingId: string;
  trainerId: string;
  status: TrainerBookingStatus;
  assignedAt: string;
  seenAt?: string;
  responseComment?: string;
}

export type NotificationChannel = 'in_app' | 'telegram' | 'whatsapp' | 'sms' | 'email';

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'trainer_assigned'
  | 'booking_time_changed'
  | 'booking_cancelled'
  | 'trainer_response_required'
  | 'booking_reminder_24h'
  | 'booking_reminder_2h';

export interface Notification {
  id: string;
  recipientRole: UserRole;
  recipientId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  bookingId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface StaffNotificationSettings {
  inApp: boolean;
  browser: boolean;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  email?: string;
  telegram?: string;
  whatsapp?: string;
}

export interface StaffAccount {
  id: string;
  role: UserRole;
  displayName: string;
  login: string;
  password: string;
  trainerId?: string;
  notificationSettings: StaffNotificationSettings;
}

export interface Booking {
  id: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientPhone: string;
  participants: BookingParticipant[];
  assignedHorses: {
    participantId: string;
    horseId: string;
  }[];
  assignedTrainerId?: string;
  trainerStatus?: TrainerBookingStatus;
  status: BookingStatus;
  comment?: string;
  adminComment?: string;
}

export type BookingRuleType =
  | 'horse_rest_after_lesson'
  | 'working_hours'
  | 'closed_date'
  | 'horse_unavailable'
  | 'max_weight'
  | 'service_duration'
  | 'custom_exception';

export interface BookingRule {
  id: string;
  name: string;
  type: BookingRuleType;
  isActive: boolean;
  config: Record<string, unknown>;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reasons: string[];
  availableHorseIds: string[];
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  reasons: string[];
  assignedHorses: {
    participantId: string;
    horseId: string;
  }[];
}

export interface Review {
  id: string;
  clientName: string;
  text: string;
  date: string;
  rating: number;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'lessons' | 'walks' | 'photosessions' | 'horses' | 'territory';
  image: string;
}

export interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  requestSchedule: string;
  messengers: {
    title: string;
    url: string;
  }[];
  socialLinks: {
    title: string;
    url: string;
  }[];
}

export interface RuleSection {
  id: string;
  title: string;
  items: string[];
}

export interface FAQItemData {
  id: string;
  question: string;
  answer: string;
}

export interface RulesInfo {
  sections: RuleSection[];
  faq: FAQItemData[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export type PageCopyKey = 'services' | 'booking' | 'rules' | 'gallery' | 'reviews' | 'contacts';

export interface PageCopy {
  eyebrow: string;
  title: string;
  text: string;
}

export interface SiteContent {
  siteName: string;
  siteSubtitle: string;
  homeEyebrow: string;
  homeHeroTitle: string;
  homeHeroText: string;
  homeHeroImage: string;
  homeHeroImagePosition: string;
  primaryColor: string;
  darkColor: string;
  accentColor: string;
  popularServicesTitle: string;
  popularServicesText: string;
  trustTitle: string;
  trustText: string;
  reviewsTitle: string;
  pageCopies: Record<PageCopyKey, PageCopy>;
}

export type ManagedPageKey = 'home' | PageCopyKey | 'serviceDetails';

export type ContentBlockType =
  | 'hero'
  | 'sectionTitle'
  | 'text'
  | 'benefits'
  | 'serviceList'
  | 'reviews'
  | 'galleryAlbum'
  | 'faq'
  | 'contacts'
  | 'cta'
  | 'rules'
  | 'map';

export interface ContentBlock {
  id: string;
  pageKey: ManagedPageKey;
  type: ContentBlockType;
  title?: string;
  subtitle?: string;
  text?: string;
  eyebrow?: string;
  imageId?: string;
  settings: Record<string, unknown>;
  order: number;
  isVisible: boolean;
}

export interface MediaFolder {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverImageId?: string;
  order: number;
  isVisible: boolean;
}

export interface MediaAsset {
  id: string;
  fileName: string;
  title: string;
  altText: string;
  url: string;
  folderId?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

export type ContentRevisionEntity = 'page' | 'service' | 'gallery' | 'horse' | 'rules' | 'contacts' | 'review';

export interface ContentRevision {
  id: string;
  entityType: ContentRevisionEntity;
  entityId: string;
  createdAt: string;
  createdBy: string;
  snapshot: unknown;
}

export interface ManagerBookingFilters {
  status?: BookingStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  trainerId?: string;
  search?: string;
}

export interface ManagerDashboardStats {
  newRequestsCount: number;
  todayBookingsCount: number;
  unassignedBookingsCount: number;
  needsClarificationCount: number;
  confirmedThisWeekCount: number;
  rejectedThisWeekCount: number;
}

export interface ManagerAttentionBooking {
  booking: Booking;
  reasons: string[];
}

export interface TrainerWorkloadSummary {
  trainerId: string;
  trainerName: string;
  bookingsCount: number;
  hoursPlanned: number;
  pendingCount: number;
  needsClarificationCount: number;
}

export interface HorseWorkloadSummary {
  horseId: string;
  horseName: string;
  bookingsCount: number;
  hoursPlanned: number;
  restWarningsCount: number;
}
