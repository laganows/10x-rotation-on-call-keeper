<architecture_analysis>
## Analiza architektury UI (logowanie i dostęp do aplikacji)

### 1) Komponenty i moduły występujące w dokumentacji i codebase

**Wymienione w specyfikacji auth (`.ai/auth-spec.md`):**
- `src/components/views/LoginView.tsx`
- `src/lib/auth/AuthProvider.tsx`
- `src/components/app/AppShellLayout.tsx`
- SSR redirecty na stronach Astro (public/protected)
- Middleware `src/middleware/index.ts` z Supabase po stronie serwera
- (docelowo) server-side Supabase client oparty o cookies
- `src/lib/http/api-client.ts` (dodawanie `Authorization: Bearer ...`)
- `src/lib/bootstrap/BootstrapProvider.tsx` (bootstrap profilu/zespołu)

**Rzeczywiście obecne w codebase (dodatkowo):**
- Strony Astro:
  - `src/pages/login.astro`
  - `src/pages/index.astro` (Generator)
  - `src/pages/members.astro` i pozostałe strony chronione
- Root React:
  - `src/components/app/ReactRoot.tsx`
- Notyfikacje i błędy:
  - `src/components/app/NotificationsProvider.tsx`
  - `src/components/app/GlobalErrorBanner.tsx`
  - `src/components/app/ToastViewport.tsx`
- Supabase klient:
  - `src/lib/auth/supabase.browser.ts` (browser)
  - `src/db/supabase.client.ts` (server / middleware + API)

### 2) Główne strony i odpowiadające komponenty

**Strony publiczne:**
- `/login` (`src/pages/login.astro`) → `ReactRoot(routeId="login")` → `LoginView`

**Strony chronione (wg PRD i auth-spec):**
- `/` (`src/pages/index.astro`) → `ReactRoot(routeId="generator")` → `ProtectedApp` → `AppShellLayout` + `GeneratorView`
- `/members` → `MembersView`
- `/unavailabilities` → `UnavailabilitiesView`
- `/plans` → `PlansListView`
- `/plans/:planId` → `PlanDetailView`
- `/stats` → `StatsView`
- `/setup` → `SetupView` (bootstrap po pierwszym logowaniu)

### 3) Przepływ danych między komponentami

- Wejście na stronę Astro → render SSR Layout → uruchomienie React (`ReactRoot`).
- `AuthProvider`:
  - Pobiera sesję (`supabase.auth.getSession`)
  - Subskrybuje zmiany (`onAuthStateChange`)
  - Jeśli `PUBLIC_AUTH_REQUIRED=true` i `status="anonymous"` → redirect klientowy do `/login`
- `LoginView`:
  - `loginWithOAuth("github")` → Supabase OAuth
  - Po zalogowaniu redirect klientowy do `/`
- `BootstrapProvider` (dla tras poza login):
  - Pobiera `/api/profile` i `/api/team`
  - Jeśli 404 → status `needsSetup` → redirect do `/setup`
  - Jeśli gotowe i jesteśmy na `/setup` → redirect do `/`
- `useApiClient`:
  - Dodaje `Authorization: Bearer <accessToken>` jeśli auth wymagany
  - Raportuje błędy do `NotificationsProvider` i wyświetla w `GlobalErrorBanner`

### 4) Krótki opis funkcjonalności kluczowych elementów

- `Layout.astro`: bazowy layout HTML i globalne style.
- `ReactRoot`: mapowanie `routeId` na widoki oraz kompozycja providerów.
- `AuthProvider`: stan auth + login/logout OAuth + client-guard.
- `LoginView`: ekran logowania przez OAuth (bez email/hasło w MVP).
- `BootstrapProvider`: po zalogowaniu ładuje profil i team; kieruje do `/setup`.
- `AppShellLayout`: top-nav + label użytkownika + Logout + kontener treści.
- `useApiClient`: wspólny klient HTTP z mapowaniem błędów i nagłówkiem auth.
- `middleware/index.ts`: dostarcza `context.locals.supabase` do endpointów API.

### Wyróżnienie zmian wynikających z nowych wymagań (auth-spec)

- Wymagane/oczekiwane: SSR redirecty na stronach `.astro` + sesja w middleware.
- W codebase: obecny jest client-guard, ale SSR redirecty i server-session są
  docelowo do wdrożenia (w diagramie oznaczone jako “do aktualizacji”).
</architecture_analysis>

<mermaid_diagram>

```mermaid
flowchart TD
  classDef updated fill:#fef3c7,stroke:#92400e,stroke-width:2px;
  classDef shared fill:#e0f2fe,stroke:#075985,stroke-width:1px;
  classDef server fill:#ede9fe,stroke:#5b21b6,stroke-width:1px;
  classDef client fill:#ecfccb,stroke:#3f6212,stroke-width:1px;

  subgraph S1["Warstwa SSR (Astro)"]
    A1["Layout.astro"]:::server
    A2["Strona Logowania"]:::server
    A3["Strony chronione"]:::server
    A4["Middleware"]:::server
  end

  subgraph C1["Warstwa UI (React)"]
    R1["ReactRoot"]:::client
    R2["AuthProvider"]:::client
    R3["NotificationsProvider"]:::client
    R4["ToastViewport"]:::client
    R5["BootstrapProvider"]:::client
    R6["ProtectedApp"]:::client
    R7["AppShellLayout"]:::client
    V1["LoginView"]:::client
    V2["SetupView"]:::client
    V3["Widoki domenowe"]:::client
    H1["useApiClient"]:::client
    B1["GlobalErrorBanner"]:::client
  end

  subgraph B2["Backend (Astro API + Supabase)"]
    P1["Astro API"]:::server
    SB1["Supabase Auth"]:::server
    SB2["Supabase DB (RLS)"]:::server
  end

  A2 --> A1
  A3 --> A1
  A1 --> R1

  R1 --> R2
  R1 --> R3
  R3 --> B1
  R3 --> R4

  R1 -->|route login| V1
  R1 -->|inne trasy| R5
  R5 --> R6
  R6 --> R7
  R7 --> V3

  V1 -->|"OAuth login"| R2
  R2 -->|"signInWithOAuth"| SB1
  R2 -->|"getSession i onAuthStateChange"| SB1
  R2 -->|"logout"| SB1

  R5 -->|"pobierz profil i zespol"| H1
  V3 -->|"zadania domenowe"| H1
  H1 -->|"fetch i token"| P1
  P1 -->|"zapytania"| SB2

  A4 -. "docelowo: sesja SSR i redirecty" .-> A3:::updated
  R2 -. "guard klientowy gdy auth wymagany" .-> V1:::updated
  V1:::updated
  R2:::updated
  A4:::updated
```

</mermaid_diagram>

