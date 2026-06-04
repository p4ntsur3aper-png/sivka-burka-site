import { useEffect, useState } from 'react';
import { EditablePageTitle } from '../components/admin/EditablePageTitle';
import { FAQItem } from '../components/ui/FAQItem';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getRules } from '../services/api';
import type { RulesInfo } from '../types';

export function RulesPage() {
  const [rules, setRules] = useState<RulesInfo>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getRules()
      .then((response) => setRules(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-section">
      <EditablePageTitle pageKey="rules" />
      {loading && <LoadingState />}
      {error && <ErrorState />}
      {rules && (
        <>
          <div className="rules-grid">
            {rules.sections.map((section) => (
              <article key={section.id} className="rule-card">
                <h3>{section.title}</h3>
                <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="faq-list">
            <h2>Частые вопросы</h2>
            {rules.faq.map((item) => <FAQItem key={item.id} item={item} />)}
          </div>
        </>
      )}
    </section>
  );
}
