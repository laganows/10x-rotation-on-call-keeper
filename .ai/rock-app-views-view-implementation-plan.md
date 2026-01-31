# Plan implementacji widoków aplikacji ROCK (MVP)

## 1. Przegląd

Celem jest wdrożenie kompletu widoków MVP dla aplikacji **Rotation On‑Call Keeper (ROCK)** w stacku **Astro 5 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui**, zgodnie z PRD i UI‑planem: deterministyczny flow **Generate → Review → Save** (Generator jako home), CRUD Members i Unavailabilities, przegląd Plans + Plan detail, oraz podstawowe Stats.

Kluczowe założenia:

- **Single-user / single-team** (MVP).
- **Deterministyczność**: UI nie “poprawia” wyniku generatora; prezentuje wynik backendu.
- **Daty liczone wg UTC**: UI operuje na `YYYY-MM-DD` i waliduje kalendarzowo poprawne daty.
- **Spójna obsługa błędów**: API używa `ApiErrorResponse` (`error.code`, `message`, `details`) i statusów 400/401/404/409/422/500.
- **Tryb auth**:
  - **Docelowo (zgodnie z PRD)**: login gate + przekazywanie sesji do API (Bearer/cookies).
  - **Aktualnie w dev (wg backendu i Bruno)**: endpointy działają bez auth (`DEFAULT_USER_ID`); UI powinno to umożliwiać przez “auth optional”/feature flag, aby nie blokować developmentu.

## 2. Routing widoku

Rekomendowany routing (Astro pages jako router, React jako “view islands”):

- `/login` — Login
- `/setup` — Setup (bootstrap missing data: Profile/Team)
- `/` — Generator (Home)
- `/members` — Members
- `/unavailabilities` — Unavailabilities
- `/plans` — Plans list
- `/plans/:planId` — Plan detail (nagłówek + assignments; opcjonalnie stats planu)
- (opcjonalnie) `/stats` — Stats global (jeśli nie chcemy go w Plans)

Zasada ochrony tras:

- Wszystkie trasy poza `/login` są **chronione** (AuthGate + bootstrap).
- Jeśli brak profilu lub teamu (404 z API) → redirect do `/setup`.

## 3. Struktura komponentów

Wysokopoziomowe drzewo komponentów (React + Astro):

```
src/pages/*.astro
└─ <RootLayout> (Astro layout)
   └─ <ReactRoot client:load>
      ├─ <AuthProvider>  // sesja supabase + feature flag "auth optional"
      │  └─ <BootstrapProvider> // /api/profile + /api/team
      │     ├─ <AppShellLayout> // top-nav + user menu + global error/toasts
      │     │  └─ <ViewOutlet>  // per-route widok
      │     │     ├─ <GeneratorView />
      │     │     ├─ <MembersView />
      │     │     ├─ <UnavailabilitiesView />
      │     │     ├─ <PlansListView />
      │     │     ├─ <PlanDetailView />
      │     │     └─ <StatsView /> (opcjonalnie)
      │     └─ <SetupView /> // gdy bootstrap incomplete
      └─ <LoginView /> // /login
```

Uwaga o Astro: najprościej utrzymać routing przez pliki w `src/pages`, a każdy `.astro` mountuje ten sam `ReactRoot` z parametrem “active route” (np. `Astro.url.pathname`) albo mountuje dedykowany widok React (mniej kodu wspólnego, ale trudniej o wspólne providery). Rekomendacja dla spójności: **jeden `ReactRoot` + wspólne providery**.

## 4. Szczegóły komponentów

Poniżej lista komponentów “must-have”, podzielona na warstwę infrastruktury i konkretne widoki.

### 4.1 `ReactRoot`
- **Opis**: Root React dla każdej strony (Astro), spina providery i renderuje właściwy widok.
- **Główne elementy**: `<div id="app">`, `<main>`, `<nav>` (wewnątrz AppShell).
- **Obsługiwane interakcje**: brak (komponent orkiestracyjny).
- **Walidacja**: brak.
- **Typy**:
  - `RouteId` (ViewModel): `"login" | "setup" | "generator" | "members" | "unavailabilities" | "plans" | "planDetail" | "stats"`
  - `RouteParams` (ViewModel): np. `{ planId?: PlanId }`
- **Props (interfejs)**:
  - `routeId: RouteId`
  - `routeParams?: RouteParams`
  - `initialUrl: string` (opcjonalnie dla query parsing)

### 4.2 `AuthProvider` + `useAuth()`
- **Opis**: dostarcza stan sesji (Supabase) i akcje login/logout. W MVP umożliwia “auth optional” (gdy backend jeszcze nie wymaga auth).
- **Główne elementy**: Context Provider, brak UI.
- **Obsługiwane interakcje**:
  - `loginWithOAuth(provider)` → redirect do Supabase OAuth
  - `logout()` → supabase signOut + redirect `/login`
- **Walidacja**:
  - jeśli `authRequired === true` i brak `session` → redirect do `/login`.
- **Typy**:
  - `AuthState` (ViewModel):
    - `authRequired: boolean`
    - `status: "loading" | "authenticated" | "anonymous"`
    - `session: { accessToken: string; userEmail: string | null } | null`
- **Props**: brak (poza `children`).

### 4.3 `BootstrapProvider` + `useBootstrap()`
- **Opis**: po wejściu do aplikacji pobiera `/api/profile` i `/api/team`. Jeśli którykolwiek zwróci 404 → aplikacja przechodzi w tryb Setup.
- **Główne elementy**: Context Provider, opcjonalny loader/skeleton.
- **Obsługiwane interakcje**:
  - `refetch()` (retry po błędzie)
- **Walidacja**:
  - rozpoznanie 404 jako “missing data” (a nie błąd krytyczny) i ustawienie `needsSetup = true`.
- **Typy**:
  - `ProfileDto` (DTO)
  - `TeamDto` (DTO)
  - `BootstrapState` (ViewModel):
    - `status: "idle" | "loading" | "ready" | "needsSetup" | "error"`
    - `profile?: ProfileDto`
    - `team?: TeamDto`
    - `error?: ApiErrorViewModel`
- **Props**: brak (poza `children`).

### 4.4 `AppShellLayout`
- **Opis**: layout dla wszystkich tras chronionych: topbar (nav), user section (displayName/email), globalny banner/toast.
- **Główne elementy**:
  - `<header>` z `<nav>` (linki: Generator, Members, Unavailabilities, Plans)
  - `<main id="content">` (slot/outlet)
  - “Skip to content” link (a11y)
- **Obsługiwane interakcje**:
  - nawigacja linkami
  - logout
- **Walidacja**: brak.
- **Typy**:
  - `NavItem` (ViewModel): `{ label: string; href: string; active: boolean }`
- **Props**:
  - `activePath: string`
  - `userLabel: string`
  - `onLogout: () => void`
  - `children: ReactNode`

### 4.5 `ApiErrorPresenter` (inline) + `GlobalErrorBanner`
- **Opis**: ujednolicone renderowanie błędów na podstawie statusu i `ApiErrorResponse`.
- **Główne elementy**: `<div role="alert">`, `<p>`, ewentualnie `<details>`.
- **Obsługiwane interakcje**:
  - “Retry” → callback
- **Walidacja**: brak.
- **Typy**:
  - `ApiErrorViewModel` (ViewModel):
    - `status: number`
    - `code: ApiErrorCode`
    - `message: string`
    - `details?: Record<string, unknown>`
    - `isNetworkError?: boolean`
- **Props**:
  - `error: ApiErrorViewModel`
  - `variant: "inline" | "banner"`
  - `onRetry?: () => void`

### 4.6 `LoginView`
- **Routing**: `/login`
- **Opis**: ekran logowania przez Supabase OAuth; jeśli user już ma sesję → redirect do `/`.
- **Główne elementy**:
  - `<h1>` tytuł
  - `<button>` “Zaloguj się”
  - `<p>` opis produktu
- **Obsługiwane interakcje**:
  - click “Zaloguj się” → `useAuth().loginWithOAuth("github")`
- **Walidacja**:
  - blokada przycisku w stanie `loading`
- **Typy**:
  - `AuthState` (ViewModel)
- **Props**: brak

### 4.7 `SetupView` (+ `SetupForm`)
- **Routing**: `/setup`
- **Opis**: tworzy brakujące rekordy: Profile i/lub Team (idempotentnie). Po sukcesie redirect do `/`.
- **Główne elementy**:
  - `<form>` z sekcją Profile (`displayName`, opcjonalne, może być `null`)
  - `<form>` z sekcją Team (`name`, wymagane)
  - CTA “Zapisz i przejdź do Generatora”
- **Obsługiwane interakcje**:
  - submit → POST `/api/profile` + POST `/api/team` (kolejność dowolna; rekomendacja: Profile → Team)
  - retry po błędzie
- **Walidacja (UI, zgodna z API)**:
  - Profile:
    - `displayName` może być pusty → wysyłaj `null` lub `""` znormalizowane do `null`
  - Team:
    - `name` wymagane, `trim`, min 1
- **Typy**:
  - `CreateProfileCommand`, `CreateTeamCommand` (Command models)
  - `ApiDataResponse<ProfileDto>`, `ApiDataResponse<TeamDto>` (DTO)
  - `SetupFormModel` (ViewModel):
    - `displayName: string` (UI)
    - `teamName: string`
- **Props**: brak

### 4.8 `GeneratorView`
- **Routing**: `/` (opcjonalnie wspiera query: `?start=YYYY-MM-DD&end=YYYY-MM-DD`)
- **Opis**: formularz zakresu dat + preview generatora + zapis planu.
- **Główne elementy**:
  - Sekcja “Zakres”:
    - `<form>`: startDate, endDate (input type="date" albo text + mask)
    - tooltip “Daty wg UTC”
    - CTA “Generate preview”
  - Sekcja “Review” (po sukcesie):
    - `UnassignedAlert` (jeśli `unassignedDays.length > 0`)
    - `AssignmentsTable` (dzień → memberId/null)
    - `MemberCountersPanel` (`savedCount`, `previewCount`, `effectiveCount`)
    - `FairnessMetrics` (historical vs preview inequality)
  - Sekcja “Save”:
    - CTA “Save plan” (aktywne tylko dla aktualnego preview)
    - inline error dla 409 (conflict)
- **Obsługiwane interakcje**:
  - change start/end
  - “Generate preview” → POST `/api/plans/preview`
  - “Save plan” → POST `/api/plans` z assignments z preview + `durationMs: 0` (MVP)
  - linki pomocnicze do `/members` i `/unavailabilities`
- **Walidacja (UI, zgodna z API i PRD)**:
  - format daty: poprawna data kalendarzowa `YYYY-MM-DD`
  - `startDate <= endDate`
  - \(1 \le\) rangeDays \(\le 365\)
  - (PRD docelowo) `startDate >= today UTC` — aktualnie backend tego nie egzekwuje, ale UI powinno to robić w MVP
  - Save:
    - tylko jeśli jest preview i daty nie zmieniły się od czasu preview
    - `durationMs >= 0`
- **Typy**:
  - `PlanPreviewCommand`, `SavePlanCommand`
  - `PlanPreviewDto`, `PlanSavedSummaryDto`
  - `GeneratorViewModel` (ViewModel):
    - `form: { startDate: string; endDate: string }`
    - `preview?: PlanPreviewDto`
    - `previewKey?: string` (np. `${startDate}|${endDate}`)
    - `previewStatus: "idle" | "loading" | "success" | "error"`
    - `saveStatus: "idle" | "saving" | "saved" | "error"`
    - `inlineError?: ApiErrorViewModel` (np. 409)
- **Props**: brak

### 4.9 `MembersView`
- **Routing**: `/members`
- **Opis**: lista członków z filtrami + dialog add/edit + soft-delete.
- **Główne elementy**:
  - Toolbar:
    - search (po `displayName`, client-side)
    - toggle `status=active|all`
    - CTA “Add member”
  - `MembersTable`:
    - kolumny: displayName, savedCount, initialOnCallCount, status, actions
    - actions: Edit, Remove (tylko dla active)
  - `MemberDialog` (Add/Edit)
  - `ConfirmDialog` dla remove
- **Obsługiwane interakcje**:
  - zmiana filtrów → GET `/api/members?...`
  - add → POST `/api/members`
  - edit → PATCH `/api/members/{memberId}`
  - remove → DELETE `/api/members/{memberId}`
- **Walidacja (UI, zgodna z API)**:
  - `displayName`: `trim`, min 1 (max zgodnie z backend schema; UI przyjmie np. 100)
  - `status` enum: active/all
  - pagination params: limit/offset (MVP: można pominąć UI paginacji i trzymać domyślnie 50/0)
- **Typy**:
  - `MemberListItemDto` (GET list)
  - `CreateMemberCommand`, `UpdateMemberCommand`
  - `MembersListQuery`
  - `MembersViewModel` (ViewModel):
    - `status: MembersListStatus`
    - `search: string`
    - `items: MemberListItemDto[]`
    - `loading: boolean`
    - `error?: ApiErrorViewModel`
- **Props**: brak

### 4.10 `UnavailabilitiesView`
- **Routing**: `/unavailabilities`
- **Opis**: lista niedostępności w zakresie + filtr membera + dodawanie (idempotentnie) + usuwanie.
- **Główne elementy**:
  - Toolbar:
    - date range start/end (domyślnie: today UTC → +30 dni)
    - preset buttons: 7/30/90/365 (ustawia endDate)
    - member filter select (`memberId?`)
    - CTA “Add unavailability”
  - `UnavailabilityDialog` (member select + day)
  - `UnavailabilitiesTable` (day asc, member, delete)
  - `ConfirmDialog` dla delete
- **Obsługiwane interakcje**:
  - zmiana filtrów → GET `/api/unavailabilities?startDate&endDate&memberId?`
  - add → POST `/api/unavailabilities?onConflict=ignore` (UI zawsze ignore w MVP, zgodnie z UI-plan)
  - delete → DELETE `/api/unavailabilities/{unavailabilityId}`
- **Walidacja (UI, zgodna z API + kod backendu)**:
  - `startDate/endDate`:
    - poprawna data kalendarzowa
    - `startDate <= endDate`
    - zakres 1–365 dni (backend: 400 dla invalid range w list)
  - add `day`: poprawna data; rekomendacja: ograniczyć do [today..today+365] (spójnie z planowaniem)
  - `memberId` musi być aktywnym memberem (UI: select z listy aktywnych)
- **Typy**:
  - `UnavailabilityDto`
  - `UnavailabilitiesListQuery`, `UnavailabilitiesCreateQuery`, `CreateUnavailabilityCommand`
  - `UnavailabilitiesViewModel` (ViewModel):
    - `range: { startDate: string; endDate: string }`
    - `memberId?: MemberId`
    - `items: UnavailabilityDto[]`
    - `loading: boolean`
    - `error?: ApiErrorViewModel`
- **Props**: brak

### 4.11 `PlansListView`
- **Routing**: `/plans`
- **Opis**: lista zapisanych planów, link do detail.
- **Główne elementy**:
  - `PlansTable`:
    - kolumny: startDate, endDate, createdAt (opcjonalnie)
    - link do `/plans/:planId`
  - empty state: link do `/` (Generator)
- **Obsługiwane interakcje**:
  - load → GET `/api/plans?limit=50&offset=0&sort=createdAt&order=desc` (domyślnie)
  - click plan row → navigate
- **Walidacja**: brak.
- **Typy**:
  - `PlanDto`, `PlansListQuery`
  - `PlansListViewModel` (ViewModel): `items`, `loading`, `error`
- **Props**: brak

### 4.12 `PlanDetailView`
- **Routing**: `/plans/:planId`
- **Opis**: pokazuje zapisany plan (header) + assignments. Opcjonalnie sekcja stats planu (tab/accordion).
- **Główne elementy**:
  - `PlanHeader` (GET `/api/plans/{planId}`)
  - `AssignmentsTable` (GET `/api/plans/{planId}/assignments`)
  - `UnassignedAlert` (na podstawie assignments z `memberId=null`)
  - (opcjonalnie) `PlanStatsPanel` (GET `/api/stats/plans/{planId}`)
- **Obsługiwane interakcje**:
  - retry osobno dla header/assignments/stats
  - link powrotny do `/plans`
- **Walidacja**:
  - `planId` jako UUID: jeśli niepoprawne → od razu błąd “invalid URL” (client-side), bez requestu
  - 404 → komunikat “Plan nie istnieje”
- **Typy**:
  - `PlanDto`, `PlanAssignmentDto`, `StatsDtoPlan`
  - `PlanDetailViewModel`:
    - `plan?: PlanDto`
    - `assignments?: PlanAssignmentDto[]`
    - `planError?: ApiErrorViewModel`
    - `assignmentsError?: ApiErrorViewModel`
    - `stats?: StatsDtoPlan`
- **Props**:
  - `planId: PlanId`

### 4.13 `StatsView` (opcjonalnie)
- **Routing**: `/stats` (lub jako sekcja/zakładka w `/plans`)
- **Opis**: globalne statystyki historii zapisanych planów.
- **Główne elementy**:
  - metryki: days total/weekdays/weekends/unassigned
  - metryki members: min/max/inequality
  - tabela byMember
- **Obsługiwane interakcje**:
  - load → GET `/api/stats?scope=global`
  - retry
- **Walidacja**:
  - scope tylko global (backend zwraca 400 dla innego)
- **Typy**:
  - `StatsDtoGlobal`
  - `StatsViewModel`: `data`, `loading`, `error`
- **Props**: brak

## 5. Typy

### 5.1 Wymagane DTO / Command models (już istnieją)

Źródło: `src/types.ts`. UI używa ich bezpośrednio w warstwie API i w ViewModelach:

- **Auth/bootstrap**:
  - `ProfileDto`, `TeamDto`
  - `CreateProfileCommand`, `UpdateProfileCommand`
  - `CreateTeamCommand`, `UpdateTeamCommand`
- **Members**:
  - `MemberDto`, `MemberListItemDto`, `MembersListQuery`
  - `CreateMemberCommand`, `UpdateMemberCommand`
- **Unavailabilities**:
  - `UnavailabilityDto`, `UnavailabilitiesListQuery`, `UnavailabilitiesCreateQuery`
  - `CreateUnavailabilityCommand`
- **Plans**:
  - `PlanDto`, `PlansListQuery`
  - `PlanAssignmentDto`, `PlanAssignmentsListQuery`
  - `PlanPreviewDto`, `PlanPreviewCommand`
  - `PlanSavedSummaryDto`, `SavePlanCommand`
- **Stats**:
  - `StatsDtoGlobal`, `StatsDtoPlan`, `StatsDto`, `StatsQuery`
- **Common**:
  - `ApiDataResponse<T>`, `ApiListResponse<T>`, `ApiErrorResponse`, `ApiErrorCode`
  - prymitywy: `YyyyMmDd`, `IsoTimestamp`, `PlanId`, `MemberId`, `UnavailabilityId`

### 5.2 Nowe typy ViewModel (do dodania w `src/lib/view-models/*` lub `src/types/ui.ts`)

Rekomendowane nowe typy (UI-only):

- `ApiErrorViewModel`
  - `status: number`
  - `code: ApiErrorCode`
  - `message: string`
  - `details?: Record<string, unknown>`
  - `isNetworkError?: boolean`
- `AsyncState<T>`
  - `status: "idle" | "loading" | "success" | "error"`
  - `data?: T`
  - `error?: ApiErrorViewModel`
- `RouteId`, `RouteParams` (opisane wyżej)
- `GeneratorViewModel`, `MembersViewModel`, `UnavailabilitiesViewModel`, `PlansListViewModel`, `PlanDetailViewModel`, `StatsViewModel` (opisane przy komponentach)
- `UtcDateRange`
  - `startDate: YyyyMmDd`
  - `endDate: YyyyMmDd`
  - `rangeDays: number`

## 6. Zarządzanie stanem

W MVP rekomendacja: **bez zewnętrznych bibliotek** (brak React Query w dependencies) i spójny zestaw custom hooków.

### 6.1 Zasady

- Każdy widok ma własny ViewModel (stan lokalny) + hook do data fetching.
- Minimalny caching:
  - Generator preview cache po `(startDate,endDate)` w `Map` (in-memory) w hooku.
  - Members/Plans/Unavailabilities: cache “last success” (zachowaj listę podczas refetch).
- Każdy request ma `AbortController` (cancel na unmount / zmiany parametrów).
- Błędy:
  - 400/422: **inline** (przy polach)
  - 409: **inline kontekstowo** (Save plan / delete)
  - 401: global redirect do `/login` (docelowo)
  - 404: empty/not found screen (plan detail) albo setup routing (profile/team)
  - 5xx/network: banner/toast + retry

### 6.2 Wymagane custom hooki

- `useApiClient()`
  - buduje `fetch` z baseUrl, JSON parsing, error normalization, opcjonalnym Authorization.
- `useBootstrap()`
  - pobiera profile/team, zarządza `needsSetup`.
- `useMembersList(query)`
  - GET members, expose `refetch`, `mutate` helpers (np. optimistic update po PATCH).
- `useUnavailabilitiesList(query)`
  - GET unavailabilities.
- `usePlansList(query)`
  - GET plans.
- `usePlanDetail(planId)`
  - GET plan header + assignments (dwa niezależne `AsyncState`).
- `usePlanPreview(range)`
  - POST preview + caching.
- `useSavePlan()`
  - POST save z `durationMs: 0` (MVP), mapuje 409 do “conflict”.
- `useStatsGlobal()`, `useStatsPlan(planId)` (opcjonalnie)

## 7. Integracja API

### 7.1 Kontrakt odpowiedzi i błędów

- Sukces:
  - `ApiDataResponse<T>`: `{ data: T }`
  - `ApiListResponse<T>`: `{ data: T[]; page: { limit; offset; total } }`
- Błąd:
  - `ApiErrorResponse`: `{ error: { code; message; details? } }`

Frontend powinien mieć 1 funkcję normalizacji:

- jeśli response ma `error` → mapuj na `ApiErrorViewModel` + status
- jeśli network error → `isNetworkError = true`

### 7.2 Lista wywołań API per widok

- **Bootstrap/Setup**
  - GET `/api/profile` → `ApiDataResponse<ProfileDto>` (404 możliwe)
  - POST `/api/profile` body `CreateProfileCommand` → `ApiDataResponse<ProfileDto>`
  - PATCH `/api/profile` body `UpdateProfileCommand` → `ApiDataResponse<ProfileDto>`
  - GET `/api/team` → `ApiDataResponse<TeamDto>` (404 możliwe)
  - POST `/api/team` body `CreateTeamCommand` → `ApiDataResponse<TeamDto>`
  - PATCH `/api/team` body `UpdateTeamCommand` → `ApiDataResponse<TeamDto>`
- **Generator**
  - POST `/api/plans/preview` body `PlanPreviewCommand` → `ApiDataResponse<PlanPreviewDto>`
  - POST `/api/plans` body `SavePlanCommand` → `ApiDataResponse<PlanSavedSummaryDto>` (409 możliwe)
- **Members**
  - GET `/api/members` query `MembersListQuery` → `ApiListResponse<MemberListItemDto>`
  - POST `/api/members` body `CreateMemberCommand` → `ApiDataResponse<MemberDto>`
  - PATCH `/api/members/{memberId}` body `UpdateMemberCommand` → `ApiDataResponse<MemberDto>`
  - DELETE `/api/members/{memberId}` → 204 (lub błąd)
- **Unavailabilities**
  - GET `/api/unavailabilities` query `UnavailabilitiesListQuery` → `ApiListResponse<UnavailabilityDto>`
  - POST `/api/unavailabilities?onConflict=ignore` body `CreateUnavailabilityCommand` → `ApiDataResponse<UnavailabilityDto>` (201 zawsze; 409 możliwe gdy onConflict=error)
  - DELETE `/api/unavailabilities/{unavailabilityId}` → 204
- **Plans**
  - GET `/api/plans` query `PlansListQuery` → `ApiListResponse<PlanDto>`
  - GET `/api/plans/{planId}` → `ApiDataResponse<PlanDto>`
  - GET `/api/plans/{planId}/assignments` query `PlanAssignmentsListQuery` → `ApiListResponse<PlanAssignmentDto>`
- **Stats**
  - GET `/api/stats?scope=global` → `ApiDataResponse<StatsDtoGlobal>`
  - GET `/api/stats/plans/{planId}` → `ApiDataResponse<StatsDtoPlan>`

### 7.3 Auth w requestach (docelowo)

Docelowo UI dodaje nagłówek:

- `Authorization: Bearer <supabase_access_token>`

W MVP (stan obecny) backend działa bez auth, więc `useApiClient` powinien:

- dodawać `Authorization` tylko jeśli mamy session i `authRequired === true`
- pozwolić na requesty bez tokena (dev)

## 8. Interakcje użytkownika

### 8.0 Mapowanie User Stories (PRD) → implementacja (komponenty/akcje)

| User Story | Implementacja (gdzie) | Konkrety (co dokładnie) |
|---|---|---|
| **US‑001** Logowanie/wylogowanie | `LoginView`, `AuthProvider`, `AppShellLayout` | OAuth sign-in, redirect, logout w headerze |
| **US‑002** Lista członków | `MembersView`, `MembersTable` | GET `/api/members?status=active` + render tabeli z `savedCount` i `initialOnCallCount` |
| **US‑003** Dodanie członka | `MemberDialog (Add)` | POST `/api/members` z `CreateMemberCommand`; po sukcesie refetch listy |
| **US‑004** Edycja członka | `MemberDialog (Edit)` | PATCH `/api/members/{memberId}` tylko `displayName` |
| **US‑005** Soft-delete członka | `ConfirmDialog` w `MembersTable` | DELETE `/api/members/{memberId}`; po sukcesie usuń z “active”, widoczny w “all” jako Removed |
| **US‑006** Dodanie niedostępności | `UnavailabilityDialog` | POST `/api/unavailabilities?onConflict=ignore` z `CreateUnavailabilityCommand` |
| **US‑007** Usunięcie niedostępności | `ConfirmDialog` w `UnavailabilitiesTable` | DELETE `/api/unavailabilities/{unavailabilityId}` + optimistic remove |
| **US‑008** Przegląd niedostępności | `UnavailabilitiesView` | GET `/api/unavailabilities?startDate&endDate&memberId?` + sort day asc |
| **US‑009** Generowanie grafiku | `GeneratorView` | POST `/api/plans/preview` z `PlanPreviewCommand`; render assignments + UNASSIGNED |
| **US‑010** Podgląd + liczniki | `MemberCountersPanel`, `FairnessMetrics`, `AssignmentsTable` | render `counters[]`, `inequality.*`, `unassignedDays[]` |
| **US‑011** Zapis planu | `GeneratorView` + `useSavePlan` | POST `/api/plans` z `SavePlanCommand`; sukces → redirect do `/plans` |
| **US‑012** Konflikt zakresów | `GeneratorView` | 409 z Save → inline błąd w sekcji Save, preview zostaje |
| **US‑013** Lista planów | `PlansListView` | GET `/api/plans` + linki do detail |
| **US‑014** Statystyki | `StatsView` i/lub `PlanStatsPanel` | GET `/api/stats?scope=global` oraz GET `/api/stats/plans/{planId}` |
| **US‑015** Wyrównanie startowe nowej osoby | `MembersView` | ekspozycja `initialOnCallCount` i `savedCount` w tabeli (transparentność) |
| **US‑016** Nierówność historyczna vs preview | `FairnessMetrics` | pokaz `inequality.historical` i `inequality.preview` + opis “max-min” |
| **US‑017** Obsługa UNASSIGNED | `UnassignedAlert` | w Generator i Plan detail: liczba + lista dni UNASSIGNED |
| **US‑018** Walidacja zakresu dat | `DateRangeForm` | inline walidacje: format, kalendarz, 1–365, today UTC |
| **US‑019** Deterministyczny tie-breaker | `GeneratorView` | tekst/help: “wynik deterministyczny; remisy po memberId” |
| **US‑020** Instrumentacja zdarzeń | `usePlanPreview`, `useSavePlan` | backend zapisuje eventy; w MVP UI wysyła `durationMs: 0` w Save |

### 8.1 Login (US‑001)
- Klik “Zaloguj się” → redirect do OAuth.
- Jeśli użytkownik ma sesję → redirect `/`.
- Logout → usuń sesję + redirect `/login`.

### 8.2 Setup (bootstrap)
- Jeśli `/api/profile` lub `/api/team` zwróci 404 → widok Setup z formularzem.
- Submit:
  - zapisuje brakujące rekordy idempotentnie
  - po sukcesie: refetch bootstrap + redirect `/`

### 8.3 Generator (US‑009..US‑012, US‑016..US‑019)
- Ustaw daty → “Generate preview”:
  - UI waliduje (format, 1–365, today UTC)
  - sukces: render Review + Save
  - błąd 422: inline przy polach dat (np. invalid range)
- Save:
  - aktywne tylko po wygenerowaniu aktualnego preview
  - 409: inline komunikat konfliktu zakresów (bez czyszczenia preview)
  - sukces: toast + redirect `/plans` (lub `/plans/:planId` – decyzja; rekomendacja: `/plans`)
  - `durationMs`: w MVP zawsze wysyłaj `0`

### 8.4 Members (US‑002..US‑005, US‑015)
- Add/Edit w dialogu:
  - błędy 400: inline (displayName)
- Remove:
  - confirm dialog
  - 409: inline “member already removed” (jeśli backend zwróci conflict)

### 8.5 Unavailabilities (US‑006..US‑008)
- Zmiana zakresu i filtra membera → automatyczny reload listy.
- Add:
  - UI wysyła `onConflict=ignore` i traktuje duplikat jako success (idempotentnie)
- Delete:
  - confirm dialog → po sukcesie usuwa rekord z listy

### 8.6 Plans + Plan detail (US‑013, US‑017)
- Plans list: klik w plan → detail.
- Plan detail: niezależne loadery i retry dla header/assignments/stats.
- UNASSIGNED: alert z listą dni (kopiowalny tekst).

## 9. Warunki i walidacja

### 9.1 Walidacje wspólne (UI)

- **YyyyMmDd**:
  - regex `^\d{4}-\d{2}-\d{2}$`
  - walidacja kalendarzowa (UTC): `Date.UTC(year, month-1, day)` i round-trip check (tak jak backend).
- **DateRange**:
  - `startDate <= endDate`
  - `rangeDays = diffDaysInclusiveUtc(start, end)` w [1..365]
  - (PRD) `startDate >= todayUtc`
- **UUID w parametrach**:
  - `planId`, `memberId`, `unavailabilityId` – walidacja przed requestem

### 9.2 Walidacje per endpoint (najważniejsze)

- `POST /api/plans/preview`:
  - UI: rangeDays 1..365 + todayUtc
  - backend: 422 “Invalid date range” jeśli rangeDays poza 1..365 lub niepoprawne daty
- `POST /api/plans`:
  - UI: assignments length = rangeDays oraz “save only from preview”
  - backend: 422 jeśli assignments nie pokrywają zakresu / duplikaty / day poza zakresem
  - backend: 409 conflict (overlap planów)
- `GET /api/unavailabilities`:
  - UI: start/end poprawne i rangeDays 1..365
  - backend: 400 dla invalid date range lub query

## 10. Obsługa błędów

Rekomendowana macierz obsługi:

- **400 `validation_error`**
  - **inline** przy polach (form validation) lub w toolbarze (query params)
  - w razie `details` (Zod flatten) mapuj do pól formularza
- **422 `unprocessable_entity`**
  - **inline** jako “semantyka domenowa” (np. zakres dat, assignments coverage)
- **401 `unauthorized`**
  - global: wyczyść sesję i redirect `/login` (docelowo)
- **404 `not_found`**
  - bootstrap: redirect `/setup`
  - plan detail: ekran “Plan nie istnieje” + link do `/plans`
- **409 `conflict`**
  - save plan: inline “Zakres nakłada się na istniejący plan”
  - delete member/unavailability: inline przy akcji (rekord już usunięty / konflikt domenowy)
- **5xx / network**
  - global banner/toast + Retry
  - zachowaj ostatnie poprawne dane (nie czyść listy na error)

## 11. Kroki implementacji

1. **Ustalenie podejścia routingowego w Astro**
   - Dodaj strony: `src/pages/login.astro`, `src/pages/setup.astro`, `src/pages/index.astro`, `src/pages/members.astro`, `src/pages/unavailabilities.astro`, `src/pages/plans/index.astro`, `src/pages/plans/[planId].astro` (+ opcjonalnie `src/pages/stats.astro`).
   - Każda strona mountuje `ReactRoot` i przekazuje `routeId`, `routeParams`, `initialUrl`.

2. **Warstwa API (spójna dla wszystkich widoków)**
   - Utwórz `src/lib/http/api-client.ts`:
     - `request<T>(...)` + obsługa `ApiErrorResponse`.
     - opcjonalny `Authorization` z `useAuth()`.
   - Utwórz `src/lib/http/api-errors.ts`:
     - mapowanie `Response` → `ApiErrorViewModel`.

3. **Auth (docelowo) + feature flag dla dev**
   - Utwórz `src/lib/auth/supabase.browser.ts` (client-side createClient).
   - Utwórz `AuthProvider` + `useAuth()`.
   - Dodaj flagę `PUBLIC_AUTH_REQUIRED` (lub podobną) aby w dev móc uruchamiać UI bez realnego OAuth.

4. **Bootstrap**
   - Utwórz `BootstrapProvider`:
     - GET `/api/profile`, GET `/api/team`.
     - 404 → `needsSetup`.
   - Dodaj routing logic: jeśli `needsSetup` i nie jesteśmy na `/setup` → redirect.

5. **App Shell**
   - Utwórz `AppShellLayout` z nav i sekcją user/logout.
   - Dodaj globalny `GlobalErrorBanner` + prosty system toastów (na start: stan w providerze).

6. **SetupView**
   - Formularz dla team name + opcjonalnie displayName.
   - POST `/api/profile` (idempotentnie) + POST `/api/team`.
   - Po sukcesie: refetch bootstrap i redirect `/`.

7. **GeneratorView**
   - Zaimplementuj `DateRangeForm` z walidacją UTC.
   - `usePlanPreview` (POST `/api/plans/preview`).
   - `AssignmentsTable`, `MemberCountersPanel`, `FairnessMetrics`, `UnassignedAlert`.
  - `useSavePlan` (POST `/api/plans` z `durationMs: 0`), obsługa 409 inline.

8. **MembersView**
   - `useMembersList` (GET `/api/members`).
   - Dialog Add/Edit z POST/PATCH.
   - ConfirmDialog + DELETE (soft-delete).
   - Filtr status active/all + search po stronie klienta.

9. **UnavailabilitiesView**
   - `useUnavailabilitiesList` (GET).
   - Presets 7/30/90/365.
   - Dialog Add (POST z `onConflict=ignore`) + delete.
   - Pobieranie members do selectów: reuse `useMembersList({ status:"active" })`.

10. **PlansListView**
   - `usePlansList` (GET `/api/plans`).
   - Tabela + empty state + linki do detail.

11. **PlanDetailView**
   - `usePlanDetail(planId)`:
     - GET plan header
     - GET assignments
   - UNASSIGNED alert.
   - (opcjonalnie) `useStatsPlan(planId)` i panel stats.

12. **(Opcjonalnie) StatsView**
   - `useStatsGlobal` (GET `/api/stats?scope=global`).
   - Metryki + tabela.

13. **Doprecyzowanie UX/a11y**
   - semantyczne tabele (`<table><thead><th scope="col">`)
   - focus management po błędach walidacji (focus na pierwsze pole)
   - `aria-live` dla toastów i bannerów
   - “Skip to content”

14. **Spójność z shadcn/ui**
   - Uzupełnij brakujące komponenty UI (w `src/components/ui`): input, dialog, select, table, alert, tabs, dropdown, toast (lub alternatywnie minimalne komponenty własne).

