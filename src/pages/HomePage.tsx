import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, HeartHandshake, ShieldCheck, Sprout } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ImageUploadButton } from '../components/admin/ImageUploadButton';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { ServiceCard } from '../components/services/ServiceCard';
import { ButtonLink } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getEditableSiteContent, isAdminAuthorized, isAdminEditMode, saveEditableSiteContent } from '../services/adminContent';
import { getPageContent, updateContentBlock } from '../services/contentRepository';
import { getReviews, getServices, getSiteContent } from '../services/api';
import type { ContentBlock, Review, Service, SiteContent } from '../types';
import { getMediaStyle } from '../utils/media';

type BenefitItem = {
  id: string;
  icon: 'sprout' | 'shield' | 'heartHandshake';
  title: string;
  text: string;
};

const benefitIconMap = {
  sprout: Sprout,
  shield: ShieldCheck,
  heartHandshake: HeartHandshake,
} as const;

function readBenefitItems(block?: ContentBlock): BenefitItem[] {
  const raw = block?.settings?.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      return {
        id: String(candidate.id || `benefit-${Math.random().toString(16).slice(2)}`),
        icon: candidate.icon === 'shield' || candidate.icon === 'heartHandshake' ? candidate.icon : 'sprout',
        title: String(candidate.title || ''),
        text: String(candidate.text || ''),
      } as BenefitItem;
    })
    .filter(Boolean) as BenefitItem[];
}

export function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>();
  const [homeBlocks, setHomeBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [adminEditMode, setAdminEditModeState] = useState(isAdminAuthorized() && isAdminEditMode());

  useEffect(() => {
    const loadHomeData = () => {
      Promise.all([getServices(), getReviews(), getSiteContent(), getPageContent('home')])
        .then(([servicesResponse, reviewsResponse, siteResponse, homeBlocksResponse]) => {
          setServices(servicesResponse.data);
          setReviews(reviewsResponse.data);
          setSiteContent(siteResponse.data);
          setHomeBlocks(homeBlocksResponse.data);
          setError(false);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    };

    const syncAdminState = () => setAdminEditModeState(isAdminAuthorized() && isAdminEditMode());

    loadHomeData();
    window.addEventListener('orlov-content-updated', loadHomeData);
    window.addEventListener('orlov-admin-state-updated', syncAdminState);

    return () => {
      window.removeEventListener('orlov-content-updated', loadHomeData);
      window.removeEventListener('orlov-admin-state-updated', syncAdminState);
    };
  }, []);

  const updateSiteContent = <K extends keyof SiteContent>(field: K, value: SiteContent[K]) => {
    const nextContent = { ...getEditableSiteContent(), ...siteContent, [field]: value } as SiteContent;
    setSiteContent(nextContent);
    saveEditableSiteContent(nextContent);
  };

  const heroBlock = useMemo(() => homeBlocks.find((block) => block.id === 'home-hero'), [homeBlocks]);
  const servicesBlock = useMemo(() => homeBlocks.find((block) => block.id === 'home-services'), [homeBlocks]);
  const benefitsBlock = useMemo(() => homeBlocks.find((block) => block.id === 'home-benefits'), [homeBlocks]);
  const trustBlock = useMemo(() => homeBlocks.find((block) => block.id === 'home-trust'), [homeBlocks]);
  const reviewsBlock = useMemo(() => homeBlocks.find((block) => block.id === 'home-reviews'), [homeBlocks]);
  const benefitItems = useMemo(() => readBenefitItems(benefitsBlock), [benefitsBlock]);
  const renderedBenefits = useMemo<BenefitItem[]>(
    () =>
      benefitItems.length > 0
        ? benefitItems
        : [
            { id: 'fallback-choice', icon: 'sprout', title: 'Спокойный выбор', text: 'На карточках услуг сразу видны цена, длительность и ограничения.' },
            { id: 'fallback-safety', icon: 'shield', title: 'Безопасность на виду', text: 'Правила и требования вынесены в отдельный раздел и повторяются перед записью.' },
            { id: 'fallback-request', icon: 'heartHandshake', title: 'Предварительная заявка', text: 'Форма честно сообщает, что запись подтверждает администратор.' },
          ],
    [benefitItems],
  );

  const updateBlock = async (block: ContentBlock | undefined, patch: Partial<ContentBlock>) => {
    if (!block) return;
    const response = await updateContentBlock(block.id, patch);
    if (!response.data) return;
    setHomeBlocks((current) => current.map((item) => (item.id === block.id ? response.data! : item)));
  };

  const updateBlockTextField = async (block: ContentBlock | undefined, field: 'eyebrow' | 'title' | 'text', value: string) => {
    await updateBlock(block, { [field]: value });
  };

  const updateBenefits = async (nextItems: BenefitItem[]) => {
    if (!benefitsBlock) return;
    await updateBlock(benefitsBlock, {
      settings: {
        ...benefitsBlock.settings,
        items: nextItems,
      },
    });
  };

  const moveBenefit = async (id: string, direction: -1 | 1) => {
    const index = benefitItems.findIndex((item) => item.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= benefitItems.length) return;

    const next = [...benefitItems];
    const currentItem = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = currentItem;
    await updateBenefits(next);
  };

  const toggleBlock = async (block: ContentBlock | undefined) => {
    if (!block) return;
    await updateBlock(block, { isVisible: !block.isVisible });
  };

  return (
    <>
      {adminEditMode && (
        <section className="page-section">
          <div className="inline-edit-panel home-blocks-panel">
            <strong>Блоки главной страницы</strong>
            <div className="home-blocks-grid">
              {[heroBlock, servicesBlock, benefitsBlock, trustBlock, reviewsBlock].filter(Boolean).map((block) => (
                <button className="button button-secondary" key={block!.id} type="button" onClick={() => void toggleBlock(block)}>
                  {block!.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  {block!.title || block!.id}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {heroBlock?.isVisible !== false && (
        <section className="hero-section">
          <div className="hero-content">
            <span className="eyebrow">{heroBlock?.eyebrow || siteContent?.homeEyebrow || 'г. Гурьевск · КТК "Сивка-Бурка"'}</span>
            <h1>{heroBlock?.title || siteContent?.homeHeroTitle || 'Конно-спортивные услуги для обучения, отдыха и семейного досуга'}</h1>
            <p>{heroBlock?.text || siteContent?.homeHeroText || 'Помогаем спокойно познакомиться с лошадьми, выбрать подходящий формат занятия и оставить предварительную заявку.'}</p>
            <div className="hero-actions">
              <ButtonLink to="/services" variant="primary">
                Посмотреть услуги <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink to="/booking" variant="secondary">
                Записаться
              </ButtonLink>
            </div>
          </div>
          <div
            className="hero-visual hero-photo"
            style={{ ...getMediaStyle(siteContent?.homeHeroImage || ''), backgroundPosition: siteContent?.homeHeroImagePosition || 'center' }}
            aria-label="Главное изображение конно-спортивной услуги"
          >
            <div className="hero-visual-content">
              <span>{siteContent?.siteName || 'КТК "Сивка-Бурка"'}</span>
            </div>
            {adminEditMode && siteContent && (
              <div className="inline-edit-panel hero-inline-panel">
                <strong>Настройки главного блока</strong>
                <label>
                  <span>Надзаголовок</span>
                  <input
                    value={heroBlock?.eyebrow || siteContent.homeEyebrow}
                    onChange={(event) => {
                      updateSiteContent('homeEyebrow', event.target.value);
                      void updateBlockTextField(heroBlock, 'eyebrow', event.target.value);
                    }}
                  />
                </label>
                <label>
                  <span>Заголовок</span>
                  <textarea
                    value={heroBlock?.title || siteContent.homeHeroTitle}
                    onChange={(event) => {
                      updateSiteContent('homeHeroTitle', event.target.value);
                      void updateBlockTextField(heroBlock, 'title', event.target.value);
                    }}
                    rows={2}
                  />
                </label>
                <label>
                  <span>Текст</span>
                  <textarea
                    value={heroBlock?.text || siteContent.homeHeroText}
                    onChange={(event) => {
                      updateSiteContent('homeHeroText', event.target.value);
                      void updateBlockTextField(heroBlock, 'text', event.target.value);
                    }}
                    rows={3}
                  />
                </label>
                <label>
                  <span>Фон: URL, gradient или data-url</span>
                  <input value={siteContent.homeHeroImage} onChange={(event) => updateSiteContent('homeHeroImage', event.target.value)} />
                </label>
                <ImageUploadButton label="Добавить файл фона" onUpload={(dataUrl) => updateSiteContent('homeHeroImage', dataUrl)} />
                <label>
                  <span>Позиция фона</span>
                  <select value={siteContent.homeHeroImagePosition} onChange={(event) => updateSiteContent('homeHeroImagePosition', event.target.value)}>
                    <option value="center">По центру</option>
                    <option value="top">Сверху</option>
                    <option value="bottom">Снизу</option>
                    <option value="left center">Слева</option>
                    <option value="right center">Справа</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </section>
      )}

      {servicesBlock?.isVisible !== false && (
        <section className="page-section">
          <SectionTitle
            eyebrow={servicesBlock?.eyebrow || 'Услуги'}
            title={servicesBlock?.title || siteContent?.popularServicesTitle || 'Популярные направления'}
            text={servicesBlock?.text || siteContent?.popularServicesText || 'Каталог услуг готов к подключению backend API.'}
          />

          {adminEditMode && (
            <div className="inline-edit-panel">
              <strong>Редактирование блока услуг</strong>
              <label>
                <span>Надзаголовок</span>
                <input value={servicesBlock?.eyebrow || ''} onChange={(event) => void updateBlockTextField(servicesBlock, 'eyebrow', event.target.value)} />
              </label>
              <label>
                <span>Заголовок</span>
                <input value={servicesBlock?.title || ''} onChange={(event) => void updateBlockTextField(servicesBlock, 'title', event.target.value)} />
              </label>
              <label>
                <span>Текст</span>
                <textarea rows={2} value={servicesBlock?.text || ''} onChange={(event) => void updateBlockTextField(servicesBlock, 'text', event.target.value)} />
              </label>
            </div>
          )}

          {loading && <LoadingState />}
          {error && <ErrorState />}
          {!loading && !error && <div className="cards-grid">{services.slice(0, 3).map((service) => <ServiceCard key={service.id} service={service} />)}</div>}
        </section>
      )}

      {(benefitsBlock?.isVisible !== false || trustBlock?.isVisible !== false) && (
        <section className="page-section split-section">
          {benefitsBlock?.isVisible !== false && (
            <div>
              <SectionTitle eyebrow={benefitsBlock?.eyebrow || 'Почему удобно'} title={benefitsBlock?.title || 'Понятный маршрут клиента'} />
              <div className="benefit-list">
                {renderedBenefits.map((benefit) => {
                  const Icon = benefitIconMap[benefit.icon] || Sprout;
                  return (
                    <article key={benefit.id}>
                      <Icon size={26} />
                      <h3>{benefit.title}</h3>
                      <p>{benefit.text}</p>
                    </article>
                  );
                })}
              </div>

              {adminEditMode && benefitsBlock && (
                <div className="inline-edit-panel">
                  <strong>Редактирование преимуществ</strong>
                  {benefitItems.map((benefit, index) => (
                    <div className="benefit-editor-row" key={benefit.id}>
                      <label>
                        <span>{benefit.title}</span>
                        <textarea
                          rows={2}
                          value={benefit.text}
                          onChange={(event) =>
                            void updateBenefits(
                              benefitItems.map((item) => (item.id === benefit.id ? { ...item, text: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                      <div className="benefit-editor-actions">
                        <button className="button button-ghost" disabled={index === 0} onClick={() => void moveBenefit(benefit.id, -1)} type="button">
                          <ArrowUp size={16} /> Вверх
                        </button>
                        <button className="button button-ghost" disabled={index === benefitItems.length - 1} onClick={() => void moveBenefit(benefit.id, 1)} type="button">
                          <ArrowDown size={16} /> Вниз
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {trustBlock?.isVisible !== false && (
            <aside className="trust-panel">
              <h2>{trustBlock?.title || siteContent?.trustTitle || 'Важно перед посещением'}</h2>
              <p>{trustBlock?.text || siteContent?.trustText || 'Перед занятием проводится инструктаж, а формат подбирается под возраст и подготовку клиента.'}</p>
              <ButtonLink to="/rules" variant="secondary">
                Правила и безопасность
              </ButtonLink>

              {adminEditMode && trustBlock && (
                <div className="inline-edit-panel">
                  <strong>Редактирование блока доверия</strong>
                  <label>
                    <span>Заголовок</span>
                    <input
                      value={trustBlock.title || ''}
                      onChange={(event) => {
                        updateSiteContent('trustTitle', event.target.value);
                        void updateBlockTextField(trustBlock, 'title', event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span>Текст</span>
                    <textarea
                      rows={3}
                      value={trustBlock.text || ''}
                      onChange={(event) => {
                        updateSiteContent('trustText', event.target.value);
                        void updateBlockTextField(trustBlock, 'text', event.target.value);
                      }}
                    />
                  </label>
                </div>
              )}
            </aside>
          )}
        </section>
      )}

      {reviewsBlock?.isVisible !== false && (
        <section className="page-section">
          <SectionTitle eyebrow={reviewsBlock?.eyebrow || 'Отзывы'} title={reviewsBlock?.title || siteContent?.reviewsTitle || 'Клиенты отмечают заботу и спокойный темп'} />

          {adminEditMode && (
            <div className="inline-edit-panel">
              <strong>Редактирование блока отзывов</strong>
              <label>
                <span>Надзаголовок</span>
                <input value={reviewsBlock?.eyebrow || ''} onChange={(event) => void updateBlockTextField(reviewsBlock, 'eyebrow', event.target.value)} />
              </label>
              <label>
                <span>Заголовок</span>
                <input
                  value={reviewsBlock?.title || ''}
                  onChange={(event) => {
                    updateSiteContent('reviewsTitle', event.target.value);
                    void updateBlockTextField(reviewsBlock, 'title', event.target.value);
                  }}
                />
              </label>
            </div>
          )}

          <div className="review-grid">{reviews.slice(0, 3).map((review) => <ReviewCard key={review.id} review={review} />)}</div>
        </section>
      )}
    </>
  );
}
