import type { Notification, StaffAccount, StaffNotificationSettings, Trainer, UserRole } from '../types';

const STAFF_ACCOUNTS_KEY = 'orlov_staff_accounts';
const BROWSER_NOTIFIED_KEY = 'orlov_browser_notified_ids';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const defaultNotificationSettings = (contacts?: Partial<StaffNotificationSettings>): StaffNotificationSettings => ({
  inApp: true,
  browser: false,
  emailEnabled: false,
  telegramEnabled: false,
  whatsappEnabled: false,
  email: contacts?.email || '',
  telegram: contacts?.telegram || '',
  whatsapp: contacts?.whatsapp || '',
});

const disableNotificationChannels = (settings: StaffNotificationSettings): StaffNotificationSettings => ({
  ...settings,
  inApp: false,
  browser: false,
  emailEnabled: false,
  telegramEnabled: false,
  whatsappEnabled: false,
});

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
  window.dispatchEvent(new Event('orlov-staff-settings-updated'));
}

function normalizeAccount(account: StaffAccount): StaffAccount {
  const notificationSettings = {
    ...defaultNotificationSettings(),
    ...(account.notificationSettings || {}),
  };

  return {
    ...account,
    notificationSettings: account.role === 'trainer' ? disableNotificationChannels(notificationSettings) : notificationSettings,
  };
}

function defaultTrainerAccount(trainer: Trainer): StaffAccount {
  return {
    id: `trainer-account-${trainer.id}`,
    role: 'trainer',
    displayName: trainer.fullName,
    login: trainer.id,
    password: 'trainer123',
    trainerId: trainer.id,
    notificationSettings: disableNotificationChannels(defaultNotificationSettings({
      email: trainer.email || '',
      whatsapp: trainer.phone || '',
    })),
  };
}

function defaultAccounts(trainers: Trainer[]): StaffAccount[] {
  return [
    {
      id: 'admin-local',
      role: 'admin',
      displayName: 'Администратор',
      login: 'admin',
      password: 'admin123',
      notificationSettings: defaultNotificationSettings(),
    },
    {
      id: 'manager-local',
      role: 'manager',
      displayName: 'Управляющий',
      login: 'manager',
      password: 'manager123',
      notificationSettings: defaultNotificationSettings(),
    },
    ...trainers.map(defaultTrainerAccount),
  ];
}

export function syncStaffAccountsWithTrainers(accounts: StaffAccount[], trainers: Trainer[]) {
  const currentById = new Map(accounts.map((account) => [account.id, normalizeAccount(account)]));
  const synced = defaultAccounts(trainers).map((defaultAccount) => {
    const existing = currentById.get(defaultAccount.id);
    if (!existing) return defaultAccount;

    return normalizeAccount({
      ...defaultAccount,
      ...existing,
      role: defaultAccount.role,
      trainerId: defaultAccount.trainerId,
      displayName: defaultAccount.role === 'trainer' ? defaultAccount.displayName : existing.displayName,
      login: defaultAccount.role === 'trainer' ? defaultAccount.login : existing.login,
      notificationSettings: {
        ...defaultAccount.notificationSettings,
        ...existing.notificationSettings,
      },
    });
  });

  const customAccounts = accounts.filter((account) => !synced.some((item) => item.id === account.id));
  return [...synced, ...customAccounts.map(normalizeAccount)];
}

export function getStaffAccounts(trainers: Trainer[] = []): StaffAccount[] {
  return syncStaffAccountsWithTrainers(defaultAccounts(trainers), trainers);
}

export function saveStaffAccounts(accounts: StaffAccount[]) {
  void accounts;
  window.dispatchEvent(new Event('orlov-staff-settings-updated'));
}

export function resetStaffAccounts() {
  window.localStorage.removeItem(STAFF_ACCOUNTS_KEY);
  window.localStorage.removeItem(BROWSER_NOTIFIED_KEY);
  window.dispatchEvent(new Event('orlov-staff-settings-updated'));
}

export function verifyAdminCredentials(login: string, password: string) {
  const admin = getStaffAccounts().find((account) => account.role === 'admin');
  return Boolean(admin && admin.login.trim().toLowerCase() === login.trim().toLowerCase() && admin.password === password);
}

export function verifyManagerCredentials(login: string, password: string) {
  const manager = getStaffAccounts().find((account) => account.role === 'manager');
  return Boolean(manager && manager.login.trim().toLowerCase() === login.trim().toLowerCase() && manager.password === password);
}

export function verifyTrainerCredentials(login: string, password: string) {
  const normalizedLogin = login.trim().toLowerCase();
  const trainerAccount = getStaffAccounts().find((account) =>
    account.role === 'trainer' &&
    (
      account.login.trim().toLowerCase() === normalizedLogin ||
      account.trainerId?.trim().toLowerCase() === normalizedLogin
    ),
  );
  return Boolean(trainerAccount && trainerAccount.password === password);
}

export function getNotificationSettings(recipientRole: UserRole, recipientId: string) {
  const account = getStaffAccounts().find((item) => {
    if (recipientRole === 'trainer') return item.role === 'trainer' && item.trainerId === recipientId;
    return item.role === recipientRole && item.id === recipientId;
  });
  if (account?.notificationSettings) return account.notificationSettings;
  return recipientRole === 'trainer' ? disableNotificationChannels(defaultNotificationSettings()) : defaultNotificationSettings();
}

export async function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function showBrowserNotification(notification: Notification) {
  const settings = getNotificationSettings(notification.recipientRole, notification.recipientId);
  if (!settings.browser || !('Notification' in window) || Notification.permission !== 'granted') return;

  const shownIds = readStorage<string[]>(BROWSER_NOTIFIED_KEY, []);
  if (shownIds.includes(notification.id)) return;

  new Notification(notification.title, {
    body: notification.message,
    tag: notification.id,
  });
  writeStorage(BROWSER_NOTIFIED_KEY, [...shownIds, notification.id].slice(-100));
}
