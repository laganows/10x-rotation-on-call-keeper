# API Endpoint Implementation Plan: Stats (`/api/stats` + `/api/stats/plans/{planId}`)

## 1. Przegląd punktu końcowego

Wdrożenie obejmuje **wszystkie endpointy ze specyfikacji**:

- **GET `/api/stats`**: zwraca **globalne statystyki** dla zapisanych planów w obrębie zespołu zalogowanego użytkownika.
- **GET `/api/stats/plans/{planId}`**: zwraca **statystyki dla pojedynczego planu** (o danym `planId`) w obrębie zespołu zalogowanego użytkownika.

Oba endpointy zwracają ten sam kształt danych (DTO `StatsDto`), różniąc się polem `scope` oraz (dla planu) `planId`.

Źródła danych (Supabase/Postgres):
- `public.teams` (wyznaczenie `team_id` dla `auth.uid()`)
- `public.plans` (weryfikacja planu i powiązania z teamem)
- `public.plan_assignments` (bazowe dane do zliczeń dni i obciążeń per member)
- `public.members` (mapowanie `memberId -> displayName`; preferencyjnie aktywni `deleted_at IS NULL`)

## 2. Szczegóły żądania

### 2.1 GET `/api/stats`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/api/stats`
- **Parametry query**:
  - **Opcjonalne**:
    - `scope`: `"global"` (domyślnie); zgodnie z typem `StatsQuery` (MVP: tylko `global` wspierane na tym endpointcie).
- **Request Body**: brak

### 2.2 GET `/api/stats/plans/{planId}`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/api/stats/plans/{planId}`
- **Parametry path**:
  - **Wymagane**:
    - `planId`: UUID (`PlanId`)
- **Request Body**: brak

### 2.3 Uwierzytelnianie (wymagane dla obu endpointów)
- **Wymagane**: użytkownik zalogowany.
- **Rekomendowany nośnik tokena (MVP)**: nagłówek `Authorization: Bearer <access_token>`.
  - Uzasadnienie: repo nie ma jeszcze SSR-helperów Supabase; bearer token pozwala walidować użytkownika i wykonywać zapytania z kontekstem `auth.uid()` (RLS) poprzez per-request klienta Supabase z nagłówkiem `Authorization`.
- **Alternatywa (docelowo)**: integracja SSR Supabase przez cookies (gdy projekt wdroży `@supabase/ssr` lub równoważny mechanizm).

## 3. Wykorzystywane typy (DTO i Command modele)

### 3.1 DTO (istniejące w `src/types.ts`)
- **Envelope**: `ApiDataResponse<T>`
- **Stats DTO**:
  - `StatsDto` (`StatsDtoGlobal | StatsDtoPlan`)
  - `StatsDaysDto`
  - `StatsMembersDto`
  - `StatsByMemberDto`
- **Query types**:
  - `StatsQuery` (`scope?: "global"`)
- **Error**:
  - `ApiErrorResponse` + `ApiErrorCode`

### 3.2 Command modele
- Brak (endpointy są tylko odczytowe).

### 3.3 Dodatkowe typy pomocnicze (do utworzenia w implementacji)
- `StatsScope`: już istnieje (`"global" | "plan"`).
- `WeekdayWeekendCounters` (wewnętrzny typ w serwisie) do liczenia dni.
- `MemberCountsMap` (wewnętrzny typ) do agregacji `memberId -> assignedDays`.

## 4. Szczegóły odpowiedzi

### 4.1 Sukces: 200

#### 4.1.1 GET `/api/stats`
- **Status**: `200`
- **Body**: `ApiDataResponse<StatsDtoGlobal>`
- Przykładowy kształt (zgodnie ze specyfikacją):
  - `data.scope = "global"`
  - `data.days = { total, weekdays, weekends, unassigned }`
  - `data.members = { min, max, inequality }`
  - `data.byMember = [{ memberId, displayName, assignedDays }]`

#### 4.1.2 GET `/api/stats/plans/{planId}`
- **Status**: `200`
- **Body**: `ApiDataResponse<StatsDtoPlan>`
  - `data.scope = "plan"`
  - `data.planId = planId`
  - pozostałe pola jak wyżej

### 4.2 Błędy (kody zgodne z wymaganiami)

- **401 Unauthorized**: brak/niepoprawny token lub brak użytkownika po walidacji.
- **404 Not Found**: tylko dla `/api/stats/plans/{planId}` gdy:
  - plan nie istnieje, albo
  - plan nie należy do teamu użytkownika (nie ujawniamy, że istnieje w innym teamie).
- **400 Bad Request**:
  - `/api/stats`: `scope` inne niż `"global"`.
  - `/api/stats/plans/{planId}`: niepoprawny format `planId` (nie-UUID).
- **500 Internal Server Error**: błędy nieobsłużone / błędy Supabase/PostgREST.

Odpowiedź błędu: `ApiErrorResponse`.

## 5. Przepływ danych

### 5.1 Wspólne kroki (dla obu endpointów)

1. **Utworzenie klienta Supabase dla requestu**:
   - Używać `context.locals.supabase` (zgodnie z regułami).
   - Upewnić się, że klient ma kontekst auth (Bearer token w nagłówku albo cookies).
2. **Walidacja autoryzacji**:
   - Odczytać token (`Authorization: Bearer ...`).
   - Walidować użytkownika: `supabase.auth.getUser(token)` (lub równoważnie, zależnie od przyjętej integracji).
   - Jeśli brak użytkownika: zwrócić `401`.
3. **Wyznaczenie `teamId`**:
   - Zapytanie: `teams` po `owner_id = user.id`, oczekiwany MVP: 1 wiersz.
   - Jeśli nie ma teamu: traktować jako `401` (brak kompletnej konfiguracji konta) lub `404` zasobu domenowego; w MVP rekomendacja: `401` z czytelnym komunikatem.
4. **Agregacja danych** (szczegóły w 5.2/5.3).
5. **Zbudowanie `StatsDto*` + envelope**:
   - policzyć `members.min/max/inequality` jako:
     - `min = min(byMember.assignedDays)`
     - `max = max(byMember.assignedDays)`
     - `inequality = max - min`
   - edge case: gdy `byMember` puste → `{ min: 0, max: 0, inequality: 0 }`.
6. **Zwrócenie `200`** z `ApiDataResponse`.

### 5.2 Agregacja dla GET `/api/stats` (global)

Cel: statystyki obejmujące **wszystkie zapisane plany** w danym `teamId`.

Rekomendowana implementacja (MVP, bez SQL RPC):
- Krok A: pobrać listę aktywnych członków (dla stabilnej listy w `byMember`):
  - `members` gdzie `team_id = teamId` i `deleted_at IS NULL`
  - pola: `member_id`, `display_name`
- Krok B: pobrać przypisania dla wszystkich planów teamu:
  - `plan_assignments` gdzie `team_id = teamId`
  - pola minimalne: `day`, `member_id`
  - (opcjonalnie) dodatkowe ograniczenie: dołączyć tylko te `plan_assignments`, które referują istniejące `plans` w teamie (dla spójności), ale przy FK na `plans(team_id, plan_id)` wystarczy filtr po `team_id`.
- Krok C: policzyć:
  - `days.total`: liczba rekordów `plan_assignments` (każdy rekord = 1 dzień w planie)
  - `days.unassigned`: liczba rekordów z `member_id IS NULL`
  - `days.weekdays/weekends`: klasyfikacja po `day` (UTC, `YYYY-MM-DD`)
    - weekend: sobota/niedziela
    - weekday: pozostałe
  - `byMember.assignedDays`: dla każdego aktywnego członka z kroku A:
    - policzyć rekordy `plan_assignments` z `member_id = memberId`
    - ignorować `member_id IS NULL`

Uwagi:
- Jeśli w historii są przypisania do memberów soft-deleted, to przy filtrze `deleted_at IS NULL` nie pojawią się w `byMember`. Jest to celowe dla UI „obecny skład”; jeśli wymagane są historyczne staty, zmienić decyzję na „wszyscy members” i/lub dołączyć soft-deleted z flagą.

### 5.3 Agregacja dla GET `/api/stats/plans/{planId}`

Krok A: walidacja `planId` (UUID).

Krok B: weryfikacja dostępu / istnienia planu:
- zapytanie `plans` gdzie `plan_id = planId` i `team_id = teamId`
- brak rekordu → `404`

Krok C: pobranie danych jak w global, ale filtrowane:
- `plan_assignments` gdzie `team_id = teamId` i `plan_id = planId`
- `members` jak w global (aktywne) lub (alternatywnie) tylko te przypisane w planie.

Krok D: policzyć metryki identycznie, ale na zbiorze dla jednego planu.

## 6. Względy bezpieczeństwa

- **AuthN**:
  - Endpointy muszą wymagać zalogowania; brak tokena lub niepoprawny token → `401`.
- **AuthZ / multi-tenancy**:
  - Wszystkie zapytania do DB muszą być zawężone przez `team_id` wyznaczony na podstawie `owner_id = auth.uid()`.
  - Dla `/api/stats/plans/{planId}` dodatkowo filtr `plan_id = planId` i `team_id = teamId` (zapobiega IDOR).
- **RLS**:
  - Projekt zakłada RLS; aby RLS działało, zapytania muszą być wykonywane z kontekstem `Authorization` (token użytkownika) lub SSR cookies.
  - Uwaga: migracja `disable_rls_policies.sql` usuwa policies — środowisko powinno mieć prawidłowe policies, inaczej zapytania będą odrzucane. Plan wdrożenia powinien uwzględnić weryfikację środowiska DB.
- **Walidacja wejścia**:
  - `scope` whitelist (`"global"`).
  - `planId` jako UUID.
  - Nie polegać na „zaufaniu do klienta”.
- **Ochrona informacji**:
  - `404` dla planu, który nie istnieje lub nie należy do teamu (nie rozróżniać w komunikatach).

## 7. Obsługa błędów

### 7.1 Standard błędów

Zwracać `ApiErrorResponse`:
- `error.code`:
  - `validation_error` dla `400`
  - `unauthorized` dla `401`
  - `not_found` dla `404`
  - `internal_error` (lub inny spójny kod) dla `500`
- `error.message`: krótki opis dla UI
- `error.details` (opcjonalnie): np. `{ field: "planId" }`

### 7.2 Scenariusze błędów (mapowanie → status)

- **Brak nagłówka Authorization / brak sesji** → `401`
- **Niepoprawny/wygaśnięty token** → `401`
- **`scope` inne niż `"global"`** → `400`
- **`planId` nie jest UUID** → `400`
- **Plan nie istnieje w teamie** → `404`
- **Błąd Supabase/PostgREST (np. brak policies/RLS)** → `500`

### 7.3 Logowanie błędów do bazy

W obecnym schemacie **nie ma tabeli błędów**. Tabela `events` ma `CHECK` na `event_type` (`plan_generated` / `plan_saved`), więc nie powinna być używana do logowania błędów.

Rekomendacja (MVP):
- logować błędy serwerowe przez `console.error()` z `requestId` (generowanym per request) i minimalnymi danymi kontekstu (`endpoint`, `teamId` jeśli dostępny, `planId` jeśli dotyczy).


## 9. Kroki implementacji

### 9.1 Struktura plików (Astro API routes + serwisy)

1. Utworzyć katalog API routes:
   - `src/pages/api/`
2. Dodać endpointy:
   - `src/pages/api/stats.ts` → `GET /api/stats`
   - `src/pages/api/stats/plans/[planId].ts` → `GET /api/stats/plans/{planId}`
3. Wyodrębnić logikę do serwisów (zgodnie z regułami):
   - utworzyć `src/lib/services/`
   - `src/lib/services/stats.service.ts`:
     - `getGlobalStats(supabase, teamId): Promise<StatsDtoGlobal>`
     - `getPlanStats(supabase, teamId, planId): Promise<StatsDtoPlan>`
   - `src/lib/services/authz.service.ts` (lub `auth.service.ts`):
     - `requireUser(context): Promise<{ userId }>` (rzuca błąd/zwrot 401)
     - `requireTeamIdForUser(supabase, userId): Promise<TeamId>`

### 9.2 Walidacja (Zod)

4. Dodać dependency `zod` (brak w `package.json`).
5. Utworzyć moduł walidacji, np.:
   - `src/lib/validation/stats.schemas.ts`
     - schema dla query `scope` (opcjonalne, tylko `"global"`)
     - schema dla `planId` (UUID)
6. Endpointy powinny:
   - walidować wejście na początku (guard clauses),
   - dla błędów walidacji zwracać `400` + `ApiErrorResponse`.

### 9.3 Supabase w `context.locals` (per-request)

7. Doprecyzować i ustandaryzować klienta Supabase:
   - w `src/db/supabase.client.ts`:
     - dodać eksport typu `SupabaseClient` (zgodnie z zasadami: nie importować typu z `@supabase/supabase-js` bezpośrednio w endpointach),
     - dodać fabrykę `createSupabaseClientForRequest(authHeaderOrToken)` zwracającą klienta ze skonfigurowanym `Authorization` per request.
8. W `src/middleware/index.ts`:
   - tworzyć klienta per request i przypisywać do `context.locals.supabase`,
   - nie polegać na singletonie `supabaseClient` bez kontekstu auth (inaczej RLS i `401` będą niespójne).

### 9.4 Implementacja endpointów

9. `GET /api/stats` (`src/pages/api/stats.ts`)
   - `export const prerender = false`
   - `export async function GET(context)`
   - kroki:
     - walidacja query (`scope`)
     - auth: wymagaj użytkownika
     - wyznacz `teamId`
     - `statsService.getGlobalStats(...)`
     - zwróć `200` z `ApiDataResponse`
   - błędy:
     - `401`, `400`, `500`

10. `GET /api/stats/plans/{planId}` (`src/pages/api/stats/plans/[planId].ts`)
   - `export const prerender = false`
   - `export async function GET(context)`
   - kroki:
     - walidacja `planId`
     - auth: wymagaj użytkownika
     - wyznacz `teamId`
     - `statsService.getPlanStats(...)` (w tym weryfikacja planu i `404`)
     - zwróć `200` z `ApiDataResponse`
   - błędy:
     - `401`, `400`, `404`, `500`

### 9.5 Spójność odpowiedzi i testy (zalecenie zespołowe)

11. Ustandaryzować helpery odpowiedzi (opcjonalne, ale zalecane):
   - `src/lib/http/api-response.ts`:
     - `ok(data)`, `badRequest(code, message, details)`, `unauthorized(...)`, `notFound(...)`, `internalError(...)`
