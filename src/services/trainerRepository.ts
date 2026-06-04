import { trainers as initialTrainers } from '../data/mockData';
import type { ApiResponse, Trainer } from '../types';
import * as backend from './backendApi';
import { env } from './env';

const TRAINERS_KEY = 'orlov_admin_trainers';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const delay = (ms = 350) => new Promise((resolve) => window.setTimeout(resolve, ms));

const respond = async <T>(data: T, ms?: number): Promise<ApiResponse<T>> => {
  await delay(ms);
  return { data };
};

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
  window.dispatchEvent(new Event('orlov-content-updated'));
}

function getStoredTrainers() {
  return readStorage<Trainer[]>(TRAINERS_KEY, initialTrainers);
}

function saveStoredTrainers(items: Trainer[]) {
  writeStorage(TRAINERS_KEY, items);
}

export async function getTrainers(): Promise<ApiResponse<Trainer[]>> {
  if (!env.useMockApi) return backend.getTrainers();
  return respond(getStoredTrainers());
}

export async function getTrainerById(id: string): Promise<ApiResponse<Trainer | undefined>> {
  if (!env.useMockApi) return backend.getTrainers().then((response) => ({ data: response.data.find((trainer) => trainer.id === id) }));
  return respond(getStoredTrainers().find((trainer) => trainer.id === id));
}

export async function createTrainer(data: Omit<Trainer, 'id'>): Promise<ApiResponse<Trainer>> {
  if (!env.useMockApi) {
    const trainer: Trainer = {
      ...data,
      id: `trainer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
    return backend.createTrainer(trainer);
  }

  const trainer: Trainer = {
    ...data,
    id: `trainer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
  saveStoredTrainers([trainer, ...getStoredTrainers()]);
  return respond(trainer);
}

export async function updateTrainer(id: string, data: Partial<Trainer>): Promise<ApiResponse<Trainer | undefined>> {
  if (!env.useMockApi) return backend.updateTrainer(id, data);
  let updatedTrainer: Trainer | undefined;
  const next = getStoredTrainers().map((trainer) => {
    if (trainer.id !== id) return trainer;
    updatedTrainer = { ...trainer, ...data, id: trainer.id };
    return updatedTrainer;
  });
  saveStoredTrainers(next);
  return respond(updatedTrainer);
}

export async function deleteTrainer(id: string): Promise<ApiResponse<{ id: string }>> {
  if (!env.useMockApi) return backend.deleteTrainer(id);
  saveStoredTrainers(getStoredTrainers().filter((trainer) => trainer.id !== id));
  return respond({ id });
}
