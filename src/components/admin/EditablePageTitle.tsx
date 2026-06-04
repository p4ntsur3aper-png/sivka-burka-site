import { useEffect, useState } from 'react';
import { getEditableSiteContent, isAdminAuthorized, isAdminEditMode, saveEditableSiteContent } from '../../services/adminContent';
import type { PageCopy, PageCopyKey, SiteContent } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';

interface EditablePageTitleProps {
  pageKey: PageCopyKey;
}

export function EditablePageTitle({ pageKey }: EditablePageTitleProps) {
  const [siteContent, setSiteContent] = useState<SiteContent>(getEditableSiteContent());
  const [adminEditMode, setAdminEditMode] = useState(isAdminAuthorized() && isAdminEditMode());
  const pageCopy = siteContent.pageCopies[pageKey];

  useEffect(() => {
    const syncContent = () => setSiteContent(getEditableSiteContent());
    const syncAdminState = () => setAdminEditMode(isAdminAuthorized() && isAdminEditMode());

    window.addEventListener('orlov-content-updated', syncContent);
    window.addEventListener('orlov-admin-state-updated', syncAdminState);

    return () => {
      window.removeEventListener('orlov-content-updated', syncContent);
      window.removeEventListener('orlov-admin-state-updated', syncAdminState);
    };
  }, []);

  const updatePageCopy = <K extends keyof PageCopy>(field: K, value: PageCopy[K]) => {
    const currentContent = getEditableSiteContent();
    const nextContent: SiteContent = {
      ...currentContent,
      pageCopies: {
        ...currentContent.pageCopies,
        [pageKey]: {
          ...currentContent.pageCopies[pageKey],
          [field]: value,
        },
      },
    };

    setSiteContent(nextContent);
    saveEditableSiteContent(nextContent);
  };

  return (
    <div className="editable-title-block">
      <SectionTitle eyebrow={pageCopy.eyebrow} title={pageCopy.title} text={pageCopy.text} />

      {adminEditMode && (
        <div className="inline-edit-panel page-title-inline-panel">
          <strong>Текст страницы</strong>
          <label>
            <span>Надзаголовок</span>
            <input value={pageCopy.eyebrow} onChange={(event) => updatePageCopy('eyebrow', event.target.value)} />
          </label>
          <label>
            <span>Заголовок</span>
            <textarea value={pageCopy.title} onChange={(event) => updatePageCopy('title', event.target.value)} rows={2} />
          </label>
          <label>
            <span>Описание</span>
            <textarea value={pageCopy.text} onChange={(event) => updatePageCopy('text', event.target.value)} rows={3} />
          </label>
        </div>
      )}
    </div>
  );
}
