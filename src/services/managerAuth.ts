import { loginStaff, logoutStaff } from './backendApi';

const MANAGER_SESSION_KEY = 'orlov_manager_session';

export function isManagerAuthorized() {
  return window.sessionStorage.getItem(MANAGER_SESSION_KEY) === 'true';
}

export async function loginManager(login: string, password: string) {
  try {
    const response = await loginStaff({ role: 'manager', login, password });
    if (response.data.role !== 'manager') return false;
    window.sessionStorage.setItem(MANAGER_SESSION_KEY, 'true');
    window.dispatchEvent(new Event('orlov-manager-state-updated'));
    return true;
  } catch {
    return false;
  }
}

export function logoutManager() {
  void logoutStaff().catch(() => undefined);
  window.sessionStorage.removeItem(MANAGER_SESSION_KEY);
  window.dispatchEvent(new Event('orlov-manager-state-updated'));
}
