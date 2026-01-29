## API Endpoint Implementation Plan: Plans (`/api/plans*`)

Ten dokument opisuje **kompletny plan wdrożenia wszystkich endpointów** z sekcji “Plans (saved)” oraz “Plan preview (generator)”:

- `GET /api/plans`
- `GET /api/plans/{planId}`
- `GET /api/plans/{planId}/assignments`
- `POST /api/plans`
- `POST /api/plans/preview`

Plan jest dopasowany do stacku: **Astro 5 + TypeScript 5 + Supabase + Zod** oraz zasad implementacji (Astro Server Endpoints, `export const prerender = false`, walidacja Zod, logika w `src/lib/services`, Supabase dostępny z `context.locals`).

---

## 1. Przegląd punktu końcowego

### Cele funkcjonalne
- **Listowanie zapisanych planów** (nagłówki planów) z paginacją i sortowaniem.
- **Pobranie nagłówka konkretnego planu**.
- **Pobranie przypisań (assignments) planu** z paginacją i sortowaniem.
- **Zapis wygenerowanego planu** jako nieedytowalnego (immutable) zasobu: insert planu + insert przypisań w jednej transakcji, aktualizacja `teams.max_saved_count`, zapis eventu `plan_saved`.
- **Podgląd (preview) planu**: deterministyczne wygenerowanie przypisań bez persystencji, z pominięciem członków usuniętych (`deleted_at`) i niedostępnych w danym dniu; zapis eventu `plan_generated`.

### Kontekst danych (DB)
Najważniejsze tabele powiązane z implementacją:
- `teams` (tenant) – źródło `team_id`, pole `max_saved_count` aktualizowane przy zapisie planu.
- `members` – aktywni członkowie to `deleted_at IS NULL`.
- `unavailabilities` – pojedynczy dzień niedostępności (`day date`), unikalność `(team_id, member_id, day)`.
- `plans` – nagłówek planu; posiada `start_date`, `end_date`, generated `date_range`; constrainty zakresu dni i **brak nakładania planów** w ramach teamu (EXCLUDE).
- `plan_assignments` – wiersz per dzień; `member_id NULL` oznacza `UNASSIGNED`.
- `events` – instrumentacja: `plan_generated` i `plan_saved`.

### Zależności typów (już istnieją w `src/types.ts`)
**DTO**:
- `PlanDto`, `PlanAssignmentDto`
- `PlanSavedSummaryDto`
- `PlanPreviewDto` (+ `PlanPreviewAssignmentDto`, `PlanPreviewCounterDto`, `PlanPreviewInequalityDto`)
- wspólne: `ApiDataResponse<T>`, `ApiListResponse<T>`, `ApiErrorResponse`, `PageDto`

**Command modele (request body)**:
- `PlanPreviewCommand`
- `SavePlanCommand`

**Query modele**:
- `PlansListQuery`
- `PlanAssignmentsListQuery`

---

## 2. Szczegóły żądania

### Wspólne wymagania dla wszystkich endpointów
- **Uwierzytelnienie**: wymagane (błędy: `401`).
- **Tenant scoping**: wszystkie operacje muszą być ograniczone do `team_id` wynikającego z użytkownika.
- **Supabase**: używać klienta z `context.locals.supabase` (nie importować bezpośrednio w route).
- **Walidacja**: Zod dla query/body/path params.

### 2.1 `GET /api/plans` — listowanie zapisanych planów
- **Query (opcjonalne)**:
  - `startDate?: YYYY-MM-DD`
  - `endDate?: YYYY-MM-DD`
  - `limit?: number` (default 50, max 200)
  - `offset?: number` (default 0)
  - `sort?: createdAt|startDate` (default `createdAt`)
  - `order?: asc|desc` (default `desc` dla `createdAt`, `asc` dla `startDate` — decyzja projektowa, patrz walidacja)

**Semantyka filtrowania dat (zalecana, spójna i użyteczna):**
- jeśli `startDate` podane → zwracaj plany, które **nakładają się** na zakres, tj. `end_date >= startDate`
- jeśli `endDate` podane → zwracaj plany, które **nakładają się** na zakres, tj. `start_date <= endDate`
- jeśli oba podane → plans overlap with `[startDate, endDate]`

### 2.2 `GET /api/plans/{planId}` — nagłówek planu
- **Path params (wymagane)**:
  - `planId: uuid`

### 2.3 `GET /api/plans/{planId}/assignments` — przypisania planu
- **Path params (wymagane)**:
  - `planId: uuid`
- **Query (opcjonalne)**:
  - `limit?: number` (default 50, max 200)
  - `offset?: number` (default 0)
  - `sort?: day` (default `day`)
  - `order?: asc|desc` (default `asc`)

### 2.4 `POST /api/plans` — zapis planu (immutable)
- **Body (wymagane)**: `SavePlanCommand`
  - `startDate: YYYY-MM-DD`
  - `endDate: YYYY-MM-DD`
  - `assignments: Array<{ day: YYYY-MM-DD, memberId: uuid|null }>`
  - `durationMs: number`

### 2.5 `POST /api/plans/preview` — podgląd generatora (bez persystencji)
- **Body (wymagane)**: `PlanPreviewCommand`
  - `startDate: YYYY-MM-DD`
  - `endDate: YYYY-MM-DD`

---

## 3. Szczegóły odpowiedzi

### 3.1 `GET /api/plans`
- **200**: `ApiListResponse<PlanDto>`
- **401**: `ApiErrorResponse` (`code: unauthorized`)

### 3.2 `GET /api/plans/{planId}`
- **200**: `ApiDataResponse<PlanDto>`
- **401**: `ApiErrorResponse`
- **404**: `ApiErrorResponse` (`code: not_found`)

### 3.3 `GET /api/plans/{planId}/assignments`
- **200**: `ApiListResponse<PlanAssignmentDto>`
- **401**: `ApiErrorResponse`
- **404**: `ApiErrorResponse` (gdy plan nie istnieje w teamie)

### 3.4 `POST /api/plans`
- **201**: `ApiDataResponse<{ plan: { planId, startDate, endDate }, assignmentsCount, unassignedCount }>` (czyli `ApiDataResponse<PlanSavedSummaryDto>`)
- **400**: `ApiErrorResponse` (błędny JSON / typy)
- **401**: `ApiErrorResponse`
- **409**: `ApiErrorResponse` (konflikt: np. nakładanie planów w teamie lub inne constrainty konfliktowe)
- **422**: `ApiErrorResponse` (semantycznie niepoprawne dane, np. assignments nie pokrywają zakresu dni)

### 3.5 `POST /api/plans/preview`
- **200**: `ApiDataResponse<PlanPreviewDto>`
- **400**: `ApiErrorResponse` (błędny JSON / typy)
- **401**: `ApiErrorResponse`
- **422**: `ApiErrorResponse` (semantycznie niepoprawny zakres dat, np. >365 dni)

---

## 4. Przepływ danych

### 4.1 Warstwy i podział odpowiedzialności
Zalecany podział na:
- **Routes (Astro Server Endpoints)** w `src/pages/api/...`:
  - parsing request, walidacja Zod, mapowanie błędów na statusy, formatowanie odpowiedzi
- **Services** w `src/lib/services`:
  - logika domenowa generatora, reguły walidacji semantycznej, dostęp do bazy (Supabase)
- **(Opcjonalnie) validators/schemas** w `src/lib/validators` albo współlokalizowane przy serwisie:
  - Zod schemas dla query/body/path

### 4.2 Uwierzytelnienie i wyznaczenie `teamId` (wspólne)
Ponieważ repo nie ma jeszcze gotowych endpointów API, trzeba zdefiniować spójny model auth:
- Przyjmij standard: `Authorization: Bearer <supabase_access_token>` dla wywołań API.
- W middleware (lub helperze) buduj **request-scoped** Supabase client z nagłówkiem Authorization (aby RLS działało per user).
- W serwisie auth:
  - `getUserOrThrow(supabase, request)` → `userId`
  - `getTeamForOwnerOrThrow(supabase, userId)` → `teamId` (MVP: 1 user = 1 team, enforced UNIQUE(owner_id))

### 4.3 Operacje DB per endpoint

#### `GET /api/plans`
1. Resolve `userId` + `teamId`.
2. Query `plans`:
   - filter `team_id = teamId`
   - optional overlap filter wg sekcji 2.1
   - sort: `created_at` lub `start_date`
   - pagination: `range(offset, offset+limit-1)` + `count: 'exact'`
3. Mapowanie DB → `PlanDto` (snake_case → camelCase).

#### `GET /api/plans/{planId}`
1. Resolve `userId` + `teamId`.
2. Query `plans` po `team_id` i `plan_id`.
3. Jeśli brak: 404.

#### `GET /api/plans/{planId}/assignments`
1. Resolve `userId` + `teamId`.
2. Sprawdź istnienie planu (query do `plans`), aby móc odróżnić “brak danych” od “brak planu”.
3. Query `plan_assignments`:
   - filter `team_id = teamId`, `plan_id = planId`
   - sort by `day`
   - pagination + count
4. Mapowanie DB → `PlanAssignmentDto`.

#### `POST /api/plans/preview`
1. Resolve `userId` + `teamId`.
2. Walidacja zakresu dat.
3. Pobierz:
   - aktywnych members (`team_id`, `deleted_at IS NULL`)
   - unavailabilities w zakresie `[startDate, endDate]` (dla tych members)
   - historyczne liczniki `savedCount` (patrz “Generator” poniżej)
4. Wygeneruj deterministyczny preview:
   - per dzień wybierz eligible membera (nieunavailable) o minimalnym `effectiveCount` (saved + preview), tie-breaker: `member_id` (stabilny).
   - jeśli brak eligible → `memberId: null`, dodaj do `unassignedDays`.
5. Wylicz `counters[]` i `inequality`.
6. Insert do `events` (`event_type = 'plan_generated'`) z polami:
   - `team_id`, `actor_user_id`, `start_date`, `end_date`, `range_days`, `members_count`, `unassigned_count`, `duration_ms` (jeśli mierzone), `metadata` (opcjonalne)

#### `POST /api/plans`
Wymaganie specyfikacji: **insert planu i assignments w jednej transakcji** + event + update team.
Najbezpieczniejsze podejście w Supabase: **RPC (Postgres function)**.

Transakcja powinna wykonać:
1. Walidacje semantyczne (można częściowo w API, częściowo w DB):
   - `startDate <= endDate`
   - \(rangeDays = endDate-startDate+1\) w [1,365]
   - `assignments.length == rangeDays`
   - każdy `day` unikalny, wszystkie w zakresie, najlepiej dokładnie wszystkie dni zakresu
   - każde `memberId != null` należy do teamu i ma `deleted_at IS NULL`
2. Insert do `plans` (`team_id`, `created_by`, `start_date`, `end_date`).
3. Insert do `plan_assignments` dla każdego dnia.
4. `UPDATE teams SET max_saved_count = max(max_saved_count, <liczba_zapisanych_planów lub inna definicja>)`
   - jeśli `max_saved_count` ma znaczyć “największa dotąd liczba zapisanych planów”, to aktualizuj na `GREATEST(current, count(plans))` (do doprecyzowania).
5. Insert `events` (`event_type = 'plan_saved'`) z `unassigned_count`, `inequality`, `duration_ms`, `members_count` (opcjonalnie), `metadata`.
6. Zwróć (z funkcji RPC) `planId`, `startDate`, `endDate`, `assignmentsCount`, `unassignedCount`.

**Mapowanie konfliktów (`409`)**:
- naruszenie EXCLUDE “no overlapping plans” w obrębie teamu
- naruszenia unikalności / constrainty konfliktowe

---

## 5. Względy bezpieczeństwa

### Uwierzytelnienie
- Endpointy wymagają autoryzacji: brak/nieprawidłowy token → **401**.
- Przyjmij Bearer token z nagłówka `Authorization`.

### Autoryzacja / tenant isolation
- Każdy query do DB musi zawierać `team_id = teamId`.
- `teamId` wyznaczać z `teams.owner_id = userId` (MVP) i traktować jako “tenant boundary”.
- Zakładać i weryfikować, że RLS w Supabase jest aktywne; nawet przy RLS włączonym, nadal jawnie filtruj po `team_id` w zapytaniach (defense in depth).

### Walidacja danych
- Wszystkie parametry wejściowe walidować Zod:
  - uuid (`planId`, `memberId`)
  - `YYYY-MM-DD` + weryfikacja poprawnej daty kalendarzowej
  - `limit/offset` jako integer, zakresy, defaulty
  - enumy sort/order

### Ochrona przed nadużyciami
- Limituj `limit` (max 200) i zakres dat (max 365 dni).
- Nie wykonuj wielu zapytań N+1; pobieraj dane wsadowo (members, unavailabilities, historical counts).
- (Opcjonalnie) rozważ rate limiting na poziomie edge/proxy, jeśli endpointy będą publiczne.

---

## 6. Obsługa błędów

### Standard odpowiedzi błędu
Używać `ApiErrorResponse` z `src/types.ts`:
- `error.code`: np. `validation_error`, `unauthorized`, `not_found`, `conflict`, `unprocessable_entity`
- `error.message`: krótki opis
- `error.details`: opcjonalne szczegóły (np. pola walidacji)

### Mapowanie typów błędów na statusy
- **400**: nieprawidłowy JSON, brak wymaganych pól, złe typy prymitywów, nieparsowalne query
- **401**: brak/niepoprawny Bearer token lub brak usera z Supabase
- **404**: plan nie istnieje w danym teamie
- **409**: konflikt DB (np. overlap planów w teamie, unique/exclude violation)
- **422**: dane formalnie poprawne, ale semantycznie niezgodne z regułami domeny (np. `assignments` nie pokrywają zakresu)
- **500**: nieobsłużone wyjątki / błędy Supabase

### Rejestrowanie błędów (“tabela błędów”)
W dostarczonych zasobach DB **nie ma dedykowanej tabeli błędów**. Zalecenie:
- Logowanie do stdout/stderr (`console.error`) w route/serwisie dla błędów 500.
- W razie potrzeby audytu domenowego używać `events.metadata` (np. `requestId`, `validationSummary`) — ale unikać przechowywania wrażliwych danych.
- (Opcjonalnie, poza MVP) dodać tabelę `errors` lub integrację z Sentry.

---



---

## 8. Kroki implementacji

### 8.1 Struktura plików (Astro)
Utworzyć foldery i endpointy:
- `src/pages/api/plans/index.ts`:
  - `GET /api/plans`
  - `POST /api/plans`
- `src/pages/api/plans/preview.ts`:
  - `POST /api/plans/preview`
- `src/pages/api/plans/[planId]/index.ts`:
  - `GET /api/plans/{planId}`
- `src/pages/api/plans/[planId]/assignments.ts`:
  - `GET /api/plans/{planId}/assignments`

W każdym pliku:
- `export const prerender = false`
- eksportować handler `GET`/`POST` (uppercase).

### 8.2 Uporządkowanie Supabase client w middleware (wymagane dla auth)
Aktualizacje w `src/middleware/index.ts` (plan):
- Zamiast singletona bez auth, tworzyć client per request:
  - odczytać `Authorization` z request headers
  - ustawić `global.headers.Authorization = Bearer ...` (jeśli obecny)
  - przypisać do `context.locals.supabase`
- Dzięki temu:
  - `supabase.auth.getUser()` będzie działać w kontekście requestu
  - RLS będzie egzekwowane per user

### 8.3 Typowanie Locals zgodnie z regułami backend
W `src/env.d.ts` obecnie importowany jest `SupabaseClient` z `@supabase/supabase-js`. Zgodnie z zasadami:
- dodać eksport typu w `src/db/supabase.client.ts`, np. `export type SupabaseClient = ReturnType<typeof createClient<Database>>`
- zmienić `src/env.d.ts`, aby używać `SupabaseClient` z `src/db/supabase.client.ts`

### 8.4 Serwisy (logika domenowa)
Utworzyć `src/lib/services/plans.service.ts` z funkcjami:
- `listPlans(supabase, userId, query): Promise<ApiListResponse<PlanDto>>`
- `getPlan(supabase, userId, planId): Promise<PlanDto>`
- `listPlanAssignments(supabase, userId, planId, query): Promise<ApiListResponse<PlanAssignmentDto>>`
- `generatePreview(supabase, userId, cmd): Promise<PlanPreviewDto>` (z insertem `events.plan_generated`)
- `savePlan(supabase, userId, cmd): Promise<PlanSavedSummaryDto>` (RPC + event `plan_saved` + update team)

Oraz `src/lib/services/auth.service.ts`:
- `getUserIdOrThrow(supabase, request): Promise<UserId>`
- `getTeamIdForOwnerOrThrow(supabase, userId): Promise<TeamId>`

### 8.5 Schemy walidacji Zod
Utworzyć `src/lib/services/plans.schemas.ts` (lub `src/lib/validators/plans.ts`) zawierające:
- `yyyyMmDdSchema` (regex + refine na poprawną datę)
- `paginationSchema` (`limit`, `offset` z defaultami i max 200)
- `plansListQuerySchema` (startDate/endDate + sort/order)
- `planIdParamSchema` (`uuid`)
- `planAssignmentsListQuerySchema`
- `planPreviewCommandSchema`
- `savePlanCommandSchema` + semantyczne refinements:
  - `startDate <= endDate`
  - `rangeDays in [1..365]`
  - assignments: unikalne dni, dni w zakresie, długość = rangeDays
  - `durationMs >= 0`

**Zasada statusów walidacyjnych**:
- parse/typy/formaty → 400
- semantyka domenowa (np. pokrycie dni) → 422

### 8.6 Generator preview: reguły deterministyczne (definicja)
Żeby generator był deterministyczny i powtarzalny:
- `savedCount`:
  - policzyć liczbę historycznych przypisań `plan_assignments` dla membera w danym teamie, gdzie `member_id = <memberId>` (pomijając `NULL`), w wszystkich zapisanych planach
  - w razie potrzeby uwzględnić `members.initial_on_call_count` jako bazę (MVP: `effectiveBase = initial_on_call_count + savedAssignmentsCount`)
- `previewCount`:
  - licznik przydziałów w ramach bieżącego preview
- `effectiveCount = savedCount + previewCount` (lub z bazą initial)
- przydział dla dnia:
  - eligible = aktywni members bez unavailability w tym dniu
  - wybierz membera o minimalnym `effectiveCount`
  - tie-breaker: `member_id` (stabilnie rosnąco)
- `inequality`:
  - spójnie w całym produkcie: zalecane jako `max(effectiveCount) - min(effectiveCount)` (integer, pasuje do DB `events.inequality`)
- `unassignedDays`:
  - dni bez eligible memberów

### 8.7 Transakcja zapisu planu (RPC)
Zaimplementować (po stronie DB) funkcję RPC, np. `api_save_plan(...)`, która:
- wykonuje insert do `plans`
- wykonuje insert do `plan_assignments`
- aktualizuje `teams.max_saved_count`
- dodaje event `plan_saved`
- zwraca summary do API

W route `POST /api/plans`:
- wywołać `supabase.rpc('api_save_plan', { ... })`
- mapować błędy Postgresa:
  - overlap/exclude violation → 409
  - FK violations (member spoza teamu) → 422 (lub 409/422 wg przyjętej polityki)

### 8.8 Implementacja route handlers (szkielet)
Każdy handler:
- guard clause: jeśli brak auth → 401
- Zod parse query/body/params → 400/422
- wywołanie serwisu
- return JSON w envelope `ApiDataResponse`/`ApiListResponse`
- `try/catch`:
  - spodziewane błędy (NotFound/Conflict/Validation) mapować na status
  - niespodziewane: 500 + log
