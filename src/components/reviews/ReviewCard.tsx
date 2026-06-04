import { Star } from 'lucide-react';
import type { Review } from '../../types';

export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="review-card">
      <div className="rating" aria-label={`Оценка ${review.rating} из 5`}>
        {Array.from({ length: review.rating }).map((_, index) => (
          <Star key={index} size={17} fill="currentColor" />
        ))}
      </div>
      <p>{review.text}</p>
      <footer>
        <strong>{review.clientName}</strong>
        <span>{review.date}</span>
      </footer>
    </article>
  );
}
