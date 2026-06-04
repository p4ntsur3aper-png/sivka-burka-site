export function LoadingState({ text = 'Загружаем данные...' }: { text?: string }) {
  return <div className="state-box">{text}</div>;
}

export function ErrorState({ text = 'Не удалось загрузить данные. Попробуйте обновить страницу.' }: { text?: string }) {
  return <div className="state-box state-error">{text}</div>;
}

export function Alert({ type, children }: { type: 'success' | 'error' | 'info'; children: React.ReactNode }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}
