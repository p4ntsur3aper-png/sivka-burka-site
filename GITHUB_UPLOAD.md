# Публикация проекта на GitHub

Этот файл описывает, как подготовить и загрузить веб-приложение конно-спортивного клуба на GitHub.

## Что уже подготовлено

- В проекте есть `.gitignore`, который исключает `node_modules/`, `dist/`, локальную SQLite-базу, `.env.local`, логи, архивы и сгенерированные Word/PDF-файлы.
- Есть `.env.example` с примером настроек frontend.
- Есть `start-local.bat` и `scripts/start-local.ps1` для простого локального запуска.
- Название npm-пакета приведено к имени проекта: `sivka-burka-site`.

## Что не нужно загружать в репозиторий

GitHub-репозиторий должен содержать исходный код и документацию, но не временные файлы. Не загружайте вручную:

- `node_modules/`
- `dist/`
- `backend/.data/`
- `.npm-cache/`
- `.env.local`
- `*.log`
- корневые PNG-файлы, если они не используются приложением
- `*.docx`
- `*.pdf`
- `docx_render_backend/`
- `diploma_work/`

Эти файлы либо создаются автоматически, либо относятся к локальной работе и не нужны для запуска проекта другим человеком.

## Вариант 1. Загрузка через Git

1. Установите Git: https://git-scm.com/download/win
2. Перезапустите PowerShell или терминал после установки.
3. Откройте папку проекта:

```powershell
cd "C:\Users\r4rel\OneDrive\Документы\sivka_burka site\sivka_site-main"
```

4. Проверьте, что Git доступен:

```powershell
git --version
```

5. Создайте новый репозиторий на GitHub:

- откройте https://github.com/new;
- укажите название, например `sivka-burka-site`;
- выберите `Public` или `Private`;
- не добавляйте README, `.gitignore` и License на сайте, потому что они уже есть в проекте;
- нажмите `Create repository`.

6. Инициализируйте Git в папке проекта:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/sivka-burka-site.git
git push -u origin main
```

Для твоего аккаунта команда будет такой:

```powershell
git remote add origin https://github.com/p4ntsur3aper-png/sivka-burka-site.git
git push -u origin main
```

Если GitHub попросит пароль, используйте не пароль от аккаунта, а Personal Access Token. Его можно создать в GitHub: `Settings -> Developer settings -> Personal access tokens`.

## Вариант 2. Загрузка через GitHub Desktop

1. Установите GitHub Desktop: https://desktop.github.com/
2. Войдите в свой GitHub-аккаунт.
3. Выберите `File -> Add local repository`.
4. Укажите папку:

```text
C:\Users\r4rel\OneDrive\Документы\sivka_burka site\sivka_site-main
```

5. Если GitHub Desktop предложит создать репозиторий, согласитесь.
6. Нажмите `Commit to main`.
7. Нажмите `Publish repository`.

## Вариант 3. Загрузка архивом через сайт GitHub

Этот способ проще, но хуже подходит для дальнейшей разработки.

1. Создайте новый репозиторий на https://github.com/new.
2. Нажмите `uploading an existing file`.
3. Перетащите в окно GitHub только файлы проекта без папок и файлов из раздела "Что не нужно загружать".
4. Нажмите `Commit changes`.

Для этого варианта лучше сначала сделать чистый архив проекта без временных файлов.

В проекте уже есть скрипт для создания такого архива:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-github-archive.ps1
```

После выполнения рядом с папкой проекта появится архив `sivka-burka-github.zip`. Его можно загрузить на GitHub через веб-интерфейс или отправить другому человеку.

## Проверка после загрузки

После публикации скачайте проект с GitHub на другой компьютер или в другую папку и проверьте запуск:

```powershell
npm install
npm run build
npm run backend:test
npm run start:local
```

Если приложение открылось по адресу `http://127.0.0.1:5174/`, backend отвечает, а вход для сотрудников работает, значит репозиторий подготовлен корректно.

## Команды для дальнейшей работы

После изменения проекта новые правки отправляются так:

```powershell
git status
git add .
git commit -m "Update project"
git push
```

Перед каждым `git add .` полезно проверять `git status`, чтобы случайно не отправить локальную базу, логи или дипломные файлы.
