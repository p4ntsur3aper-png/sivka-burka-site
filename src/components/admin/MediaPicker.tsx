import { ImagePlus, Library } from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { createMediaAsset, getMediaAssets, getMediaFolders } from '../../services/contentRepository';
import type { MediaAsset, MediaFolder } from '../../types';

interface MediaPickerProps {
  label?: string;
  onSelect: (url: string, asset?: MediaAsset) => void;
}

export function MediaPicker({ label = 'Добавить файл', onSelect }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [folderId, setFolderId] = useState('');

  const loadMedia = () => {
    setLoading(true);
    Promise.all([getMediaAssets(), getMediaFolders()])
      .then(([assetsResponse, foldersResponse]) => {
        setAssets(assetsResponse.data);
        setFolders(foldersResponse.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    loadMedia();
  }, [open]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;

      const nextTitle = title.trim() || file.name;
      const nextAlt = altText.trim() || nextTitle;
      const response = await createMediaAsset({
        fileName: file.name,
        title: nextTitle,
        altText: nextAlt,
        url: reader.result,
        folderId: folderId || undefined,
        mimeType: file.type || 'image/*',
        sizeBytes: file.size,
      });

      onSelect(response.data.url, response.data);
      setTitle('');
      setAltText('');
      setFolderId('');
      loadMedia();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="media-picker">
      <div className="file-upload-control">
        <button type="button" className="button button-secondary" onClick={() => inputRef.current?.click()}>
          <ImagePlus size={17} />
          {label}
        </button>
        <button type="button" className="button button-ghost" onClick={() => setOpen((current) => !current)}>
          <Library size={17} />
          Медиатека
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} />
      </div>

      {open && (
        <div className="inline-edit-panel">
          <strong>Загрузка и выбор изображения</strong>
          <label>
            <span>Название файла в библиотеке</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Главный фон" />
          </label>
          <label>
            <span>Alt-текст</span>
            <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Краткое описание изображения" />
          </label>
          <label>
            <span>Папка</span>
            <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">Без папки</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.title}
                </option>
              ))}
            </select>
          </label>

          {loading && <small>Загружаем медиатеку...</small>}
          {!loading && (
            <div className="media-picker-grid">
              {assets.map((asset) => (
                <button
                  className="media-picker-item"
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset.url, asset);
                    setOpen(false);
                  }}
                >
                  <div className="media-picker-thumb" style={{ backgroundImage: `url(${asset.url})` }} />
                  <strong>{asset.title}</strong>
                  <span>{asset.altText}</span>
                </button>
              ))}
              {assets.length === 0 && <small>В медиатеке пока нет изображений.</small>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
