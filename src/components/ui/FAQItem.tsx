import type { FAQItemData } from '../../types';

export function FAQItem({ item }: { item: FAQItemData }) {
  return (
    <details className="faq-item">
      <summary>{item.question}</summary>
      <p>{item.answer}</p>
    </details>
  );
}
