# Architektura modułu autentykacji (logowanie/wylogowanie, email/hasło)

## 0. Kontekst i cele

Zakres specyfikacji dotyczy modułu auth zgodnego z wymaganiami PRD (US-001) oraz stackiem: Astro 5 + React 19 + TypeScript 5 + Supabase Auth. Kluczowe założenia:

- Dostęp do aplikacji wyłącznie po zalogowaniu (w produkcji); brak ról i wielozespołowości w MVP.
- Obecne zachowanie aplikacji nie może zostać naruszone: App Shell z top-nav działa po zalogowaniu, a po pierwszym logowaniu uruchamia się Setup (bootstrap profilu/zespołu).
- Zakres MVP obejmuje logowanie/wylogowanie email/hasło; rejestracja i odzyskiwanie hasła są poza MVP (formularze UI bez backendu).
- OAuth GitHub jest poza MVP (do rozważenia w kolejnym etapie).
- Auth w trybie dev może być opcjonalny (flaga `PUBLIC_AUTH_REQUIRED`).

## 1. Architektura interfejsu użytkownika

### 1.1. Widoki i routing (auth vs non-auth)

**Trasy publiczne (unauth):**
- `/login` — logowanie (email/hasło).
- `/register` — rejestracja (UI; backend poza MVP).
- `/recover` — odzyskiwanie konta (UI; backend poza MVP).

W MVP nie przewidujemy innych tras auth poza powyższymi.

**Trasy chronione (auth):**
- `/` (Generator), `/members`, `/unavailabilities`, `/plans`, `/plans/:planId`, `/stats`, `/setup`.

### 1.2. Komponenty i rozszerzenia

**Do rozszerzenia:**
- `src/components/views/LoginView.tsx`
  - Formularz email/hasło zgodny z US-001.
  - Walidacja wymaganych pól (bez integracji backendu).
- `src/lib/auth/AuthProvider.tsx`
  - `logout` bez zmian funkcjonalnych.
  - Logowanie email/hasło do podłączenia w kolejnym kroku.
- `src/components/app/AppShellLayout.tsx`
  - Bez zmian w strukturze; utrzymanie Logout i labela użytkownika.

**Nowe komponenty (React):**
- `src/components/views/RegisterView.tsx` (formularz rejestracji, UI-only).
- `src/components/views/RecoverView.tsx` (formularz odzyskiwania konta, UI-only).

**Nowe/rozszerzone typy:**
- `src/lib/view-models/ui.ts`: nowe `RouteId` dla `register` i `recover`.

### 1.3. Podział odpowiedzialności: Astro vs React

**Astro (`src/pages/*.astro`):**
- Każda strona jest SSR (z `output: "server"` w `astro.config.mjs`).
- Strony auth wykonują server-side redirect, gdy użytkownik już ma aktywną sesję (np. `/login` -> `/`).
- Strony chronione wykonują server-side redirect do `/login`, jeśli brak sesji i `PUBLIC_AUTH_REQUIRED=true`.
- Astro przekazuje do ReactRoot `routeId` i `initialUrl`.

**React (views + hooks):**
- Prosty widok logowania (email/hasło), interakcje UI i obsługa stanów.
- Integracja z Supabase Auth (email/hasło + sign-out).
- Kontrolowanie nawigacji po sukcesie (np. redirect do `/setup`).

### 1.4. Walidacje i komunikaty błędów

**Logowanie (`/login`, email/hasło):**
- Pola email/hasło z walidacją required + format email.
- Błędy:
  - Nieprawidłowe dane -> komunikat "Nieprawidłowy email lub hasło."
  - Problemy sieciowe -> toast + banner globalny.
- Po stronie klienta: blokada wielokrotnego kliknięcia (loading).

**Rejestracja (`/register`):**
- Formularz UI; walidacja email/hasło/powtórzenie hasła.
- Backend rejestracji poza MVP.

**Odzyskiwanie (`/recover`):**
- Formularz UI; email wymagany.
- Backend odzyskiwania konta poza MVP.

**Wspólne zasady:**
- Błędy 5xx i sieciowe w `GlobalErrorBanner` (z `NotificationsProvider`).

### 1.5. Scenariusze kluczowe

- **Nowy użytkownik (email/hasło)**: `/login` -> podanie danych -> `/setup` (jeśli brak profilu/zespołu).
- **Powrót po zalogowaniu**: sesja aktywna -> `/login` przekierowuje do `/`.
- **Wylogowanie**: kliknięcie Logout -> `signOut()` -> redirect do `/login`.
- **Brak sesji**: wejście na `/members` -> redirect do `/login` (SSR i client guard).
- **Tryb dev**: `PUBLIC_AUTH_REQUIRED=false` -> brak blokady, ale login nadal dostępny.

## 2. Logika backendowa

### 2.1. Endpointy API i kontrakty

Auth może działać bezpośrednio na Supabase SDK w przeglądarce. W MVP (email/hasło) nie przewidujemy endpointów dla rejestracji/resetu; opcjonalnie tylko wsparcie dla SSR i wylogowania:

**`/api/auth` (opcjonalny namespace w MVP):**
- `POST /api/auth/sign-out`
  - Response: `204 No Content`, czyszczenie cookies.
- `GET /api/auth/session`
  - Response: `{ data: { userId, email } }` lub `401`.

**Kontrakty w `src/types.ts`:**
- `AuthSessionDto` (np. `userId`, `email`, `accessToken` jeśli wymagane).

### 2.2. Modele danych

- Supabase Auth: `auth.users` jako źródło kont (email, provider).
- `public.profiles`: `user_id` powiązany z `auth.users.id`.
- `public.teams`: `owner_id` = `auth.uid()` (jedna drużyna na użytkownika w MVP).
- Brak dodatkowych tabel dla auth poza istniejącymi `profiles`/`teams`.

### 2.3. Mechanizm walidacji danych wejściowych

- Walidacja formularzy po stronie klienta (required, format email, zgodność hasła).
- Jeśli w przyszłości dodamy backend dla email/hasło, wrócić do walidacji w Zod i `parseJsonBody`.

### 2.4. Obsługa wyjątków i mapowanie błędów

- Spójny format `ApiErrorResponse` (`error.code`, `error.message`, `details`).
- Mapowanie Supabase -> HTTP (dotyczy tylko, gdy używamy `/api/auth`):
  - Nieprawidłowe dane logowania -> 401 `unauthorized`.
  - Inne błędy auth -> 401 `unauthorized`.
- Logowanie błędów po stronie serwera z kontekstem (np. `[api/auth]`).

### 2.5. SSR i renderowanie stron (Astro)

Uwzględniając `output: "server"` i adapter `@astrojs/node`:

- Strony auth oraz chronione powinny być SSR (opcjonalnie `export const prerender = false` dla jawności).
- Middleware (`src/middleware/index.ts`) powinien tworzyć server-side Supabase client z cookies i udostępniać:
  - `context.locals.supabase`
  - `context.locals.session` / `context.locals.user`
- Strony chronione robią redirect po stronie serwera, gdy brak sesji (i authRequired).
- Strony publiczne (`/login`) robią redirect do `/` jeśli sesja istnieje.

## 3. System autentykacji (Supabase Auth + Astro)

### 3.1. Konfiguracja Supabase

- OAuth GitHub poza MVP (opcjonalnie do włączenia w przyszłości).
- Logowanie email/hasło w MVP; rejestracja i odzyskiwanie hasła poza MVP.
- Ustawione URL-e przekierowań (gdy będzie to potrzebne):
  - `Site URL` -> domena aplikacji.
  - `Redirect URLs` -> ścieżki dla flow auth (np. `/login`, `/recover`).

### 3.2. Zarządzanie sesją

**Client-side:**
- `AuthProvider` korzysta z `supabase.auth.getSession()` i `onAuthStateChange`.
- `AuthState` przechowuje `status`, `accessToken`, `userEmail`.
- `useApiClient` dodaje `Authorization: Bearer <token>` dla endpointów domenowych.

**Server-side (SSR):**
- `supabase.server` (np. `src/lib/auth/supabase.server.ts`) używa cookies (`Astro.cookies`) do utrzymania sesji.
- Middleware weryfikuje sesję i ustawia `context.locals.userId`.
- Po wylogowaniu cookies są czyszczone.

### 3.3. Integracja z API i RLS

- Usunięcie `DEFAULT_USER_ID` w produkcji; `userId` pochodzi z sesji.
- Polityki RLS:
  - `profiles.user_id = auth.uid()`
  - `teams.owner_id = auth.uid()`
  - Pozostałe tabele powiązane przez `team_id` należący do użytkownika.
- API zwraca 401 przy braku/nieprawidłowym tokenie.

### 3.4. Spójność z istniejącymi modułami

- `BootstrapProvider` pozostaje bez zmian w logice: po zalogowaniu pobiera `/api/profile` i `/api/team`.
- `SetupView` dalej obsługuje brak profilu/zespołu po pierwszym logowaniu.
- `AppShellLayout` pokazuje email lub `displayName` i utrzymuje przycisk Logout.

## 4. Mapowanie na US-001

- **Logowanie i wylogowanie (US-001):**
  - Logowanie email/hasło w `LoginView`; OAuth GitHub poza MVP.
  - `AuthProvider.logout()` wywołuje Supabase `signOut()` i redirect do `/login`.
  - Bez aktywnej sesji brak dostępu do funkcji (redirect w SSR + client guard).

