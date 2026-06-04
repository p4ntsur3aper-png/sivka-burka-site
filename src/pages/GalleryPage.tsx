import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EditablePageTitle } from '../components/admin/EditablePageTitle';
import { ImageUploadButton } from '../components/admin/ImageUploadButton';
import { Button } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingState } from '../components/ui/States';
import {
  createEmptyGalleryItem,
  getEditableGalleryItems,
  isAdminAuthorized,
  isAdminEditMode,
  saveEditableGalleryItems,
} from '../services/adminContent';
import { getGalleryItems } from '../services/api';
import type { GalleryItem } from '../types';
import { getMediaStyle } from '../utils/media';

const gallerySections: { value: GalleryItem['category']; title: string; text: string }[] = [
  { value: 'walks', title: 'Прогулки', text: 'Маршруты, спокойный темп и прогулки по территории.' },
  { value: 'lessons', title: 'Занятия', text: 'Тренировки, инструктаж и первые шаги в верховой езде.' },
  { value: 'photosessions', title: 'Фотосессии', text: 'Постановочные кадры с лошадьми и семейные съемки.' },
  { value: 'horses', title: 'Лошади', text: 'Лошади клуба, их характер и спокойная атмосфера.' },
  { value: 'territory', title: 'Территория', text: 'Место проведения занятий, манеж и зоны отдыха.' },
];

const defaultCategoryImage: Record<GalleryItem['category'], string> = {
  lessons: 'linear-gradient(135deg, #315734, #b67f4a)',
  walks: 'linear-gradient(135deg, #4d6f4f, #d8b978)',
  photosessions: 'linear-gradient(135deg, #69513a, #e1c7a0)',
  horses: 'linear-gradient(135deg, #352216, #8f6f4d)',
  territory: 'linear-gradient(135deg, #375c42, #d7bc80)',
};

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(isAdminAuthorized() && isAdminEditMode());

  useEffect(() => {
    const loadGallery = () => {
      getGalleryItems()
        .then((response) => setItems(response.data))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    };
    const syncAdminState = () => setAdminEditMode(isAdminAuthorized() && isAdminEditMode());

    loadGallery();
    window.addEventListener('orlov-content-updated', loadGallery);
    window.addEventListener('orlov-admin-state-updated', syncAdminState);

    return () => {
      window.removeEventListener('orlov-content-updated', loadGallery);
      window.removeEventListener('orlov-admin-state-updated', syncAdminState);
    };
  }, []);

  const groupedItems = useMemo(
    () =>
      gallerySections.map((section) => ({
        ...section,
        items: items.filter((item) => item.category === section.value),
      })),
    [items],
  );

  const saveGallery = (nextItems: GalleryItem[]) => {
    setItems(nextItems);
    saveEditableGalleryItems(nextItems);
  };

  const updateItem = <K extends keyof GalleryItem>(id: string, field: K, value: GalleryItem[K]) => {
    saveGallery(getEditableGalleryItems().map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = (category: GalleryItem['category']) => {
    const newItem = {
      ...createEmptyGalleryItem(),
      id: `gallery-${Date.now()}`,
      title: `Новое фото: ${gallerySections.find((section) => section.value === category)?.title || 'Галерея'}`,
      category,
      image: defaultCategoryImage[category],
    };
    saveGallery([newItem, ...getEditableGalleryItems()]);
  };

  const deleteItem = (id: string) => {
    saveGallery(getEditableGalleryItems().filter((item) => item.id !== id));
  };

  return (
    <section className="page-section gallery-page">
      <EditablePageTitle pageKey="gallery" />

      {loading && <LoadingState />}
      {error && <ErrorState />}

      {!loading && !error && (
        <>
          <div className="gallery-story">
            {groupedItems.map((section) => (
              <section className="gallery-section" id={`gallery-${section.value}`} key={section.value}>
                <div className="gallery-section-heading">
                  <div>
                    <span className="eyebrow">{section.items.length} фото</span>
                    <h2>{section.title}</h2>
                    <p>{section.text}</p>
                  </div>
                  {adminEditMode && (
                    <Button variant="secondary" onClick={() => addItem(section.value)}>
                      <Plus size={18} /> Добавить фото
                    </Button>
                  )}
                </div>

                <div className="gallery-masonry">
                  {section.items.map((item) => (
                    <article className="gallery-photo-card" key={item.id}>
                      <div className="gallery-photo-media" style={getMediaStyle(item.image)}>
                        <h3>{item.title}</h3>
                      </div>

                      {adminEditMode && (
                        <div className="inline-edit-panel gallery-inline-panel">
                          <strong>Редактирование фото</strong>
                          <label>
                            <span>Заголовок</span>
                            <input value={item.title} onChange={(event) => updateItem(item.id, 'title', event.target.value)} />
                          </label>
                          <label>
                            <span>Категория</span>
                            <select value={item.category} onChange={(event) => updateItem(item.id, 'category', event.target.value as GalleryItem['category'])}>
                              {gallerySections.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>URL или gradient</span>
                            <input value={item.image} onChange={(event) => updateItem(item.id, 'image', event.target.value)} />
                          </label>
                          <ImageUploadButton label="Добавить файл фото" onUpload={(dataUrl) => updateItem(item.id, 'image', dataUrl)} />
                          <button className="button button-ghost danger-button" type="button" onClick={() => deleteItem(item.id)}>
                            <Trash2 size={17} /> Удалить фото
                          </button>
                        </div>
                      )}
                    </article>
                  ))}

                  {section.items.length === 0 && (
                    <div className="state-box">В этом альбоме пока нет фотографий.</div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <section className="gallery-folders" aria-label="Папки галереи">
            <SectionTitle eyebrow="Папки" title="Все фотографии по разделам" text="Нижний блок работает как каталог папок, где сгруппированы все загруженные изображения." />
            <div className="folder-grid">
              {groupedItems.map((section) => (
                <a className="folder-card" href={`#gallery-${section.value}`} key={section.value}>
                  <FolderOpen size={28} />
                  <strong>{section.title}</strong>
                  <span>{section.items.length} фото</span>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
