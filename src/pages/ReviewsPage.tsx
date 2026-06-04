import { useEffect, useState } from 'react';
import { EditablePageTitle } from '../components/admin/EditablePageTitle';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getReviews } from '../services/api';
import type { Review } from '../types';

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getReviews()
      .then((response) => setReviews(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-section">
      <EditablePageTitle pageKey="reviews" />
      {loading && <LoadingState />}
      {error && <ErrorState />}
      {!loading && !error && <div className="review-grid">{reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</div>}
    </section>
  );
}
