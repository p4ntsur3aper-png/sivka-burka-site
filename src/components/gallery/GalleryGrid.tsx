import type { GalleryItem } from '../../types';
import { getMediaStyle } from '../../utils/media';

const categoryLabels: Record<GalleryItem['category'], string> = {
  lessons: 'Занятия',
  walks: 'Прогулки',
  photosessions: 'Фотосессии',
  horses: 'Лошади',
  territory: 'Территория',
};

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <div className="gallery-grid">
      {items.map((item) => (
        <article className="gallery-card" key={item.id} style={getMediaStyle(item.image)}>
          <span>{categoryLabels[item.category]}</span>
          <h3>{item.title}</h3>
        </article>
      ))}
    </div>
  );
}
