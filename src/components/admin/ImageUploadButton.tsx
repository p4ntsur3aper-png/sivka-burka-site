import { MediaPicker } from './MediaPicker';

interface ImageUploadButtonProps {
  label?: string;
  onUpload: (dataUrl: string) => void;
}

export function ImageUploadButton({ label = 'Добавить файл', onUpload }: ImageUploadButtonProps) {
  return <MediaPicker label={label} onSelect={(url) => onUpload(url)} />;
}
