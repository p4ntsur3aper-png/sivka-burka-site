import type { ApiResponse, Trainer } from '../types';
import * as backend from './backendApi';

export const getTrainers = (): Promise<ApiResponse<Trainer[]>> => backend.getTrainers();

export const getTrainerById = async (id: string): Promise<ApiResponse<Trainer | undefined>> => {
  const response = await backend.getTrainers();
  return { data: response.data.find((trainer) => trainer.id === id) };
};

export const createTrainer = (data: Omit<Trainer, 'id'>): Promise<ApiResponse<Trainer>> =>
  backend.createTrainer({
    ...data,
    id: `trainer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });

export const updateTrainer = (id: string, data: Partial<Trainer>): Promise<ApiResponse<Trainer | undefined>> =>
  backend.updateTrainer(id, data);

export const deleteTrainer = (id: string): Promise<ApiResponse<{ id: string }>> => backend.deleteTrainer(id);
