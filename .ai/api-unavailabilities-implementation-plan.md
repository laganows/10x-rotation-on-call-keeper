## API Endpoint Implementation Plan: c (`/api/unavailabilities*`)

## 1. Przegląd punktu końcowego
Zasób **Unavailabilities** pozwala zarządzać niedostępnościami członków zespołu (pojedynczy dzień). Operacje są **zawsze scope’owane do teamu** bieżącego użytkownika (MVP: team właściciela).

Wymagania bazodanowe (istotne dla implementacji):
- Tabela `public.unavailabilities`: `unavailability_id`, `team_id`, `member_id`, `day`, `created_at`
- Ograniczenie unikalności: `UNIQUE (team_id, member_id, day)`
- FK `(team_id, member_id) -> members(team_id, member_id)` oraz `team_id -> teams(team_id)`

## 2. Szczegóły żądania

### GET `/api/unavailabilities`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/api/unavailabilities`
- **Auth**: wymagany (401 jeśli brak)
- **Query params**
  - Wymagane:
    - `startDate: YyyyMmDd`
    - `endDate: YyyyMmDd`
  - Opcjonalne:
    - `memberId?: MemberId`
    - `limit?: number` (default 50, max 200)
    - `offset?: number` (default 0)
    - `sort?: "day"` (default `"day"`)
    - `order?: "asc"|"desc"` (default `"asc"`)

### POST `/api/unavailabilities`
- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/unavailabilities`
- **Auth**: wymagany (401 jeśli brak)
- **Query params**
  - `onConflict?: "error"|"ignore"` (default `"error"`)
- **Request body**
  - `CreateUnavailabilityCommand`:
    - `memberId: MemberId`
    - `day: YyyyMmDd`

### DELETE `/api/unavailabilities/{unavailabilityId}`
- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/api/unavailabilities/[unavailabilityId]`
- **Auth**: wymagany (401 jeśli brak)
- **Path params**
  - `unavailabilityId: UnavailabilityId`

### Wykorzystywane typy

### DTO (odpowiedzi)
- `UnavailabilityDto`
- `ApiListResponse<UnavailabilityDto>` (GET)
- `ApiDataResponse<UnavailabilityDto>` (POST) *(rekomendacja: spójny envelope)*
- `ApiErrorResponse` (błędy)

### Query / Command (żądania)
- `UnavailabilitiesListQuery` (GET query)
- `UnavailabilitiesCreateQuery` (POST query: `onConflict`)
- `CreateUnavailabilityCommand` (POST body)

## 3. Szczegóły odpowiedzi

### GET `/api/unavailabilities`
- **200 OK**
  - Body: `ApiListResponse<UnavailabilityDto>`
  - `page.total`: całkowita liczba rekordów pasujących do filtrów (dla danego teamu)
- **400 Bad Request**
  - `ApiErrorResponse` z `code="validation_error"`
- **401 Unauthorized**
  - `ApiErrorResponse` z `code="unauthorized"`
- **500 Internal Server Error**
  - `ApiErrorResponse` z `code="server_error"` (lub inny spójny kod projektu)

### POST `/api/unavailabilities`
- **201 Created**
  - Body: `ApiDataResponse<UnavailabilityDto>` (albo `UnavailabilityDto`, jeśli projekt nie używa envelopów dla “single”)
  - Przy `onConflict=ignore`: zwrócić istniejący rekord w tej samej strukturze i nadal **201**, aby trzymać się specyfikacji.
- **400 Bad Request**
  - `validation_error`
- **401 Unauthorized**
  - `unauthorized`
- **404 Not Found**
  - `not_found` (gdy `memberId` nie należy do teamu / jest “deleted”)
- **409 Conflict**
  - `conflict` (gdy duplikat i `onConflict=error`)
- **500 Internal Server Error**
  - `server_error`

### DELETE `/api/unavailabilities/{unavailabilityId}`
- **204 No Content**
- **401 Unauthorized**
  - `unauthorized`
- **404 Not Found**
  - `not_found` (brak rekordu w teamie)
- **500 Internal Server Error**
  - `server_error`

## 4. Przepływ danych

### Wspólny krok: ustalenie tożsamości i team scope
1. Endpoint pobiera `supabase` z `context.locals.supabase` (zgodnie z zasadami).
2. Endpoint ustala `userId`:
   - rekomendacja: `const { data: { user } } = await supabase.auth.getUser()`; jeśli `!user` -> 401.
3. Endpoint ustala `teamId` dla usera:
   - MVP: `teams.owner_id == user.id` → pobierz `team_id`; jeśli brak -> 404 lub 401 (rekomendacja: 404 “team not found” jest bezpieczniejsze informacyjnie).

### GET flow
1. Walidacja query (Zod) i normalizacja defaultów (`limit/offset/sort/order`).
2. Budowa zapytania do `unavailabilities`:
   - `eq('team_id', teamId)`
   - `gte('day', startDate)` + `lte('day', endDate)`
   - opcjonalnie `eq('member_id', memberId)`
   - `order('day', { ascending: order === 'asc' })` + opcjonalnie tie-breaker `order('unavailability_id', ...)`
   - `.range(offset, offset + limit - 1)`
   - pobranie count (`{ count: 'exact' }`) dla `page.total`
3. Mapowanie na `UnavailabilityDto[]` i zwrot 200.

### POST flow
1. Walidacja query (`onConflict`) i body (`memberId`, `day`).
2. Sprawdzenie członka:
   - `members` gdzie `team_id == teamId` i `member_id == memberId` i `deleted_at IS NULL`
   - jeśli brak → 404
3. Próba insert do `unavailabilities`:
   - wartości: `{ team_id: teamId, member_id: memberId, day }`
4. Obsługa konfliktu:
   - jeśli insert zwróci błąd unikalności i `onConflict=error` → 409
   - jeśli insert zwróci błąd unikalności i `onConflict=ignore` → pobierz istniejący rekord po `(team_id, member_id, day)` i zwróć 201 z istniejącym DTO
5. Mapowanie na `UnavailabilityDto` i zwrot 201.

### DELETE flow
1. Walidacja path param `unavailabilityId` (UUID).
2. Usunięcie w scope teamu:
   - `delete()` z `unavailabilities` gdzie `team_id == teamId` i `unavailability_id == unavailabilityId`
3. Jeśli nic nie usunięto → 404, wpp → 204.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: endpointy wymagają zalogowanego użytkownika (401).
  - Plan zakłada, że `context.locals.supabase` ma kontekst auth (cookies/JWT).
- **Autoryzacja (team-scope)**:
  - Każde zapytanie musi filtrować po `team_id == teamId`.
  - Dodatkowo rekomendowane RLS w Supabase:
    - SELECT/INSERT/DELETE na `unavailabilities` tylko jeśli `team_id` należy do teamu usera (`teams.owner_id = auth.uid()` w MVP).
- **Ochrona przed IDOR**:
  - DELETE i GET nigdy nie operują “po samym ID” bez filtra po `team_id`.
- **Limitowanie zasobów**:
  - walidować `limit <= 200`, `offset >= 0`
  - walidować maksymalną długość zakresu dat (np. `<= 365`)

## 6. Obsługa błędów

### Mapowanie błędów walidacji
- Zod `safeParse` → 400 z:
  - `code="validation_error"`
  - `message="Invalid request"`
  - `details`: np. `issues` z Zod (bez wrażliwych danych)

### Mapowanie błędów domenowych
- Brak usera → 401 (`unauthorized`)
- Brak teamu dla usera → 404 (`not_found`) lub 401 (ustalić jedną konwencję)
- Brak membera w teamie / member soft-deleted → 404 (`not_found`)
- Konflikt unikalności przy create:
  - `onConflict=error` → 409 (`conflict`)
  - `onConflict=ignore` → 201 z istniejącym rekordem

### Błędy Supabase / nieoczekiwane
- Logować po stronie serwera (min: `console.error({ route, userId, teamId, err })`).
- Zwracać 500 z `ApiErrorResponse` i bez ujawniania detali implementacyjnych.

## 8. Kroki implementacji

### 8.1 Struktura plików (Astro Server Endpoints)
1. Utworzyć endpointy:
   - `src/pages/api/unavailabilities.ts` (GET + POST)
   - `src/pages/api/unavailabilities/[unavailabilityId].ts` (DELETE)
2. Ustawić w obu:
   - `export const prerender = false`
   - eksporty `GET`, `POST`, `DELETE` w uppercase.

### 8.2 Typowanie `context.locals.supabase` zgodnie z regułami
1. W `src/db/supabase.client.ts` dodać/wyeksportować typ klienta (np. `export type SupabaseClient = ReturnType<typeof createClient<Database>>`).
2. Zaktualizować `src/env.d.ts` aby importował typ `SupabaseClient` z `src/db/supabase.client.ts` (zamiast `@supabase/supabase-js`).

### 8.3 Uwierzytelnianie dla API (kluczowe, żeby 401 i RLS miały sens)
1. Zmienić `src/middleware/index.ts`, aby tworzył per-request Supabase client z kontekstem cookies/JWT (np. podejście SSR).
2. Ustalić jedną metodę przekazywania sesji:
   - cookies (preferowane w SSR) albo `Authorization: Bearer <JWT>` dla klientów API.
3. Dopiero po tym `supabase.auth.getUser()` będzie wiarygodnym źródłem usera w endpointach.

### 8.4 Walidacja Zod
1. Dodać schemy w jednym miejscu (rekomendacja):
   - `src/lib/validation/unavailabilities.schemas.ts`
2. Schemy:
   - `UnavailabilitiesListQuerySchema`
   - `UnavailabilitiesCreateQuerySchema`
   - `CreateUnavailabilityCommandSchema`
   - `UnavailabilityIdParamSchema` (uuid)
3. Normalizacja defaultów w Zod (np. `.default(50)`).

### 8.5 Warstwa serwisów
1. Dodać `src/lib/services/unavailabilities.service.ts`:
   - przyjmuje `supabase` + `teamId` + zwalidowane inputy
   - zawiera całą logikę DB (query/insert/delete) oraz mapowanie konfliktów.
2. Dodać wspólny helper do ustalenia `teamId`:
   - `src/lib/services/team.service.ts` (lub podobnie), funkcja `getTeamIdForUserOrThrow`.

### 8.6 Implementacja endpointów
1. GET:
   - parse query → Zod → `teamId` → service → 200
2. POST:
   - parse query + body → Zod → `teamId` → service → 201 / 409 / 404
3. DELETE:
   - parse path → Zod → `teamId` → service → 204 / 404

### 8.7 Spójna obsługa odpowiedzi i błędów
1. Dodać helpery odpowiedzi (rekomendacja):
   - `src/lib/http/respond.ts` z funkcjami `jsonOk`, `jsonCreated`, `jsonError`, `noContent`
2. Ustandaryzować shape błędów wg `ApiErrorResponse`.

### 8.8 Testy / weryfikacja (jeśli projekt ma infrastrukturę testową)
- Testy jednostkowe service (walidacja zakresu, konflikt, ignore).
- Testy integracyjne endpointów (401, 200 list, 201 create, 409 conflict, 204 delete).

