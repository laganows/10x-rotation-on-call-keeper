# Architektura modułu autentykacji (logowanie/wylogowanie, OAuth)

## 0. Kontekst i cele

Zakres specyfikacji dotyczy modułu auth zgodnego z wymaganiami PRD (US-001) oraz stackiem: Astro 5 + React 19 + TypeScript 5 + Supabase Auth. Kluczowe założenia:

- Dostęp do aplikacji wyłącznie po zalogowaniu (w produkcji); brak ról i wielozespołowości w MVP.
- Obecne zachowanie aplikacji nie może zostać naruszone: OAuth login (np. GitHub) pozostaje dostępny, App Shell z top-nav działa po zalogowaniu, a po pierwszym logowaniu uruchamia się Setup (bootstrap profilu/zespołu).
- Zakres MVP obejmuje wyłącznie logowanie/wylogowanie przez OAuth; rejestracja email/hasło i odzyskiwanie hasła są poza MVP.
- Auth w trybie dev może być opcjonalny (flaga `PUBLIC_AUTH_REQUIRED`).

## 1. Architektura interfejsu użytkownika

### 1.1. Widoki i routing (auth vs non-auth)

**Trasy publiczne (unauth):**
- `/login` — logowanie (OAuth, np. GitHub).

W MVP nie przewidujemy dodatkowych tras auth.

**Trasy chronione (auth):**
- `/` (Generator), `/members`, `/unavailabilities`, `/plans`, `/plans/:planId`, `/stats`, `/setup`.

### 1.2. Komponenty i rozszerzenia

**Do rozszerzenia:**
- `src/components/views/LoginView.tsx`
  - Utrzymanie przycisku OAuth (GitHub) zgodnie z US-001.
  - Uproszczony widok: brak pól email/hasło w MVP.
- `src/lib/auth/AuthProvider.tsx`
  - Zachowanie `loginWithOAuth` i `logout` bez zmian funkcjonalnych.
  - Metody email/hasło poza MVP (do ewentualnego dodania później).
- `src/components/app/AppShellLayout.tsx`
  - Bez zmian w strukturze; utrzymanie Logout i labela użytkownika.

**Nowe komponenty (React):**
- Brak w MVP (logowanie wyłącznie przez `/login` i OAuth).

**Nowe/rozszerzone typy:**
- `src/lib/view-models/ui.ts`: brak nowych `RouteId` w MVP.

### 1.3. Podział odpowiedzialności: Astro vs React

**Astro (`src/pages/*.astro`):**
- Każda strona jest SSR (z `output: "server"` w `astro.config.mjs`).
- Strony auth wykonują server-side redirect, gdy użytkownik już ma aktywną sesję (np. `/login` -> `/`).
- Strony chronione wykonują server-side redirect do `/login`, jeśli brak sesji i `PUBLIC_AUTH_REQUIRED=true`.
- Astro przekazuje do ReactRoot `routeId` i `initialUrl`.

**React (views + hooks):**
- Prosty widok logowania (OAuth), interakcje UI i obsługa stanów.
- Integracja z Supabase Auth (OAuth sign-in/out).
- Kontrolowanie nawigacji po sukcesie (np. redirect do `/setup`).

### 1.4. Walidacje i komunikaty błędów

**Logowanie (`/login`, OAuth):**
- Brak pól formularza w MVP; pojedynczy przycisk OAuth.
- Błędy:
  - `access_denied` / `oauth_callback_error` -> komunikat "Nie udało się zalogować. Spróbuj ponownie."
  - Problemy sieciowe -> toast + banner globalny.
- Po stronie klienta: blokada wielokrotnego kliknięcia (loading).

**Wspólne zasady:**
- Błędy 5xx i sieciowe w `GlobalErrorBanner` (z `NotificationsProvider`).

### 1.5. Scenariusze kluczowe

- **Nowy użytkownik (OAuth)**: `/login` -> OAuth -> powrót -> `/setup` (jeśli brak profilu/zespołu).
- **Powrót po zalogowaniu**: sesja aktywna -> `/login` przekierowuje do `/`.
- **Wylogowanie**: kliknięcie Logout -> `signOut()` -> redirect do `/login`.
- **Brak sesji**: wejście na `/members` -> redirect do `/login` (SSR i client guard).
- **Tryb dev**: `PUBLIC_AUTH_REQUIRED=false` -> brak blokady, ale login nadal dostępny.

## 2. Logika backendowa

### 2.1. Endpointy API i kontrakty

Auth może działać bezpośrednio na Supabase SDK w przeglądarce. W MVP (OAuth) nie przewidujemy endpointów dla rejestracji/resetu; opcjonalnie tylko wsparcie dla SSR i wylogowania:

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

- Brak dodatkowej walidacji w MVP (OAuth bez formularzy).
- Jeśli w przyszłości dodamy email/hasło, wrócić do walidacji w Zod i `parseJsonBody`.

### 2.4. Obsługa wyjątków i mapowanie błędów

- Spójny format `ApiErrorResponse` (`error.code`, `error.message`, `details`).
- Mapowanie Supabase -> HTTP (dotyczy tylko, gdy używamy `/api/auth`):
  - `access_denied` / `oauth_callback_error` -> 401 `unauthorized` lub 400 `bad_request` (zależnie od kontekstu).
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

- Włączone provider-y OAuth: GitHub (zgodnie z US-001).
- Rejestracja email/hasło poza MVP (opcjonalnie do włączenia w przyszłości).
- Ustawione URL-e przekierowań:
  - `Site URL` -> domena aplikacji.
  - `Redirect URLs` -> ścieżki wymagane przez OAuth (np. `/login`), bez `/reset-password` w MVP.

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
  - OAuth GitHub w `LoginView`.
  - `AuthProvider.logout()` wywołuje Supabase `signOut()` i redirect do `/login`.
  - Bez aktywnej sesji brak dostępu do funkcji (redirect w SSR + client guard).

