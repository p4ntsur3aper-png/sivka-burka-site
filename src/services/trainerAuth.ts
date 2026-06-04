import { loginStaff, logoutStaff } from './backendApi';
import { env } from './env';
import { verifyTrainerCredentials } from './staffSettings';

const TRAINER_SESSION_KEY = 'orlov_trainer_session';

export function getAuthorizedTrainerId() {
  return window.sessionStorage.getItem(TRAINER_SESSION_KEY);
}

export function isTrainerAuthorized() {
  return Boolean(getAuthorizedTrainerId());
}

export async function loginTrainer(login: string, password: string) {
  const normalizedLogin = login.trim();
  if (!env.useMockApi) {
    if (!normalizedLogin) return false;
    try {
      const response = await loginStaff({ role: 'trainer', login: normalizedLogin, password });
      if (response.data.role !== 'trainer' || !response.data.trainerId) return false;
      window.sessionStorage.setItem(TRAINER_SESSION_KEY, response.data.trainerId);
      window.dispatchEvent(new Event('orlov-trainer-state-updated'));
      return true;
    } catch {
      return false;
    }
  }

  if (!normalizedLogin || !verifyTrainerCredentials(normalizedLogin, password)) return false;
  window.sessionStorage.setItem(TRAINER_SESSION_KEY, normalizedLogin.toLowerCase());
  window.dispatchEvent(new Event('orlov-trainer-state-updated'));
  return true;
}

export function logoutTrainer() {
  if (!env.useMockApi) void logoutStaff().catch(() => undefined);
  window.sessionStorage.removeItem(TRAINER_SESSION_KEY);
  window.dispatchEvent(new Event('orlov-trainer-state-updated'));
}
