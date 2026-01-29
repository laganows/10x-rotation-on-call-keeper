## API Endpoint Implementation Plan: Members (`/api/members`, `/api/members/{memberId}`)

## 1. Przegląd punktu końcowego
Endpointy **Members** obsługują CRUD członków zespołu w MVP (z soft-delete):

- **GET `/api/members`**: lista członków (domyślnie tylko aktywni).
- **POST `/api/members`**: dodanie członka; `initialOnCallCount` jest ustawiane na `team.maxSavedCount` i jest niezmienialne.
- **PATCH `/api/members/{memberId}`**: edycja wyłącznie danych prezentacyjnych (`displayName`).
- **DELETE `/api/members/{memberId}`**: soft-delete (ustawia `deletedAt`/`deleted_at`), członek znika z listy aktywnych i nie jest brany do nowych grafików, historia pozostaje.

Zakres danych:
- Tabela: `public.members` (`deleted_at` do soft-delete).
- Tenant boundary: `public.teams` (MVP: 1 user = 1 team, powiązanie po `teams.owner_id = auth.uid()`).

Wymagania techniczne:
- Astro 5 Server Endpoints (`src/pages/api/...`), TypeScript 5.
- Supabase jako DB+Auth.
- Walidacja wejścia: **Zod**.
- Zasady projektu: **w endpointach używać `context.locals.supabase` (bez bezpośredniego importu klienta)**.

## 2. Szczegóły żądania

### Wspólne wymagania
- **Autentykacja**: wymagana sesja Supabase (brak sesji → 401).
- **Źródło tożsamości**: `supabase.auth.getUser()` (userId z Supabase Auth).
- **Nagłówki**:
  - `Content-Type: application/json` dla POST/PATCH.

### GET `/api/members`
- **Metoda HTTP**: `GET`
- **Parametry**
  - **Wymagane**: brak
  - **Opcjonalne (query)**:
    - `status`: `active | all` (default `active`)
    - `limit`: number (default 50, max 200)
    - `offset`: number (default 0, min 0)
    - `sort`: `createdAt | displayName` (opcjonalne; jeśli brak, domyślnie `createdAt`)
    - `order`: `asc | desc` (opcjonalne; jeśli brak, domyślnie `desc` dla `createdAt`, `asc` dla `displayName`)
- **Body**: brak

### POST `/api/members`
- **Metoda HTTP**: `POST`
- **Parametry**
  - **Wymagane**: brak (poza autentykacją)
  - **Opcjonalne**: brak
- **Request Body (Command Model)**:
  - `{ "displayName": "string" }`
  - Pole wymagane, string po `trim()`, min 1 znak, rekomendowany max (np. 100) dla ochrony UI/DB.

### PATCH `/api/members/{memberId}`
- **Metoda HTTP**: `PATCH`
- **Parametry**
  - **Wymagane (path)**:
    - `memberId`: UUID
  - **Opcjonalne**: brak
- **Request Body (Command Model)**:
  - `{ "displayName": "string" }`
  - Pole wymagane, string po `trim()`, min 1 znak, rekomendowany max (np. 100).

### DELETE `/api/members/{memberId}`
- **Metoda HTTP**: `DELETE`
- **Parametry**
  - **Wymagane (path)**:
    - `memberId`: UUID
  - **Opcjonalne**: brak
- **Body**: brak

## 3. Szczegóły odpowiedzi

### Wspólne typy odpowiedzi
- Sukces:
  - `MemberDto`
  - `ApiDataResponse<MemberDto>` (dla POST/PATCH)
  - `ApiListResponse<MemberDto>` (dla GET)
- Błąd:
  - `ApiErrorResponse` (spójny envelope dla 4xx/5xx)

### GET `/api/members`
- **200 OK**: `ApiListResponse<MemberDto>`
- **401 Unauthorized**: brak sesji
- **500 Internal Server Error**: błąd serwera

### POST `/api/members`
- **201 Created**: `ApiDataResponse<MemberDto>`
- **400 Bad Request**: niepoprawny JSON / niepoprawne body
- **401 Unauthorized**: brak sesji
- **422 Unprocessable Entity**: niespełnione warunki domenowe (np. użytkownik nie ma jeszcze teamu, nie można ustalić `maxSavedCount`)
- **500 Internal Server Error**: błąd serwera

### PATCH `/api/members/{memberId}`
- **200 OK**: `ApiDataResponse<MemberDto>`
- **400 Bad Request**: niepoprawny UUID w path / niepoprawny JSON / niepoprawne body
- **401 Unauthorized**: brak sesji
- **404 Not Found**: członek nie istnieje w teamie użytkownika (lub jest poza tenantem)
- **500 Internal Server Error**: błąd serwera

### DELETE `/api/members/{memberId}`
- **204 No Content**: soft-delete wykonany
- **401 Unauthorized**: brak sesji
- **404 Not Found**: członek nie istnieje w teamie użytkownika (lub jest poza tenantem)
- **409 Conflict**: konflikt domenowy (rekomendacja MVP: próba usunięcia członka już soft-deleted)
- **500 Internal Server Error**: błąd serwera

## 4. Przepływ danych

### 4.1 Warstwa HTTP (Astro endpoints)
Proponowane pliki (zgodne z konwencją Astro):
- `src/pages/api/members/index.ts`
  - `export const prerender = false`
  - `export async function GET(context)`
  - `export async function POST(context)`
- `src/pages/api/members/[memberId].ts`
  - `export const prerender = false`
  - `export async function PATCH(context)`
  - `export async function DELETE(context)`

Każdy handler:
1. **Guard: Supabase client**: pobrać z `context.locals.supabase`.
2. **Auth**: `supabase.auth.getUser()`:
   - brak użytkownika → 401.
3. **Walidacja wejścia (Zod)**:
   - GET: query (`status`, `limit`, `offset`, `sort`, `order`)
   - POST/PATCH: body (`displayName`)
   - PATCH/DELETE: `memberId` z path.
4. **Ustalenie tenant context**:
   - odczytać `teamId` użytkownika (MVP: SELECT z `teams` po `owner_id = user.id`).
5. **Wywołanie warstwy serwisowej** (logika + DB).
6. **Mapowanie encji DB → DTO** i zwrot odpowiedzi.

### 4.2 Warstwa serwisowa (logika domenowa + DB)
Nowy serwis: `src/lib/services/members.service.ts`.

Odpowiedzialności:
- Ustalenie `teamId` (bez przyjmowania `teamId` od klienta).
- Budowa zapytań Supabase do `public.members`.
- Wspólne mapowanie `DbMember` → `MemberDto`.
- Mapowanie błędów Supabase/DB na błędy domenowe i HTTP.

Rekomendowane funkcje serwisu:
- `listMembers(params: { userId: UserId; query: MembersListQuery })`
- `createMember(params: { userId: UserId; command: CreateMemberCommand })`
- `updateMember(params: { userId: UserId; memberId: MemberId; command: UpdateMemberCommand })`
- `softDeleteMember(params: { userId: UserId; memberId: MemberId })`

Opcjonalnie (jeśli będzie współdzielone z innymi endpointami): wydzielić `src/lib/services/team.service.ts` z `getTeamForOwner(userId)` i używać go w `members.service.ts`.

### 4.3 Operacje DB (tabele i reguły)

#### `public.teams`
Wykorzystywane pola:
- `team_id`, `owner_id`, `max_saved_count`

Zachowanie:
- Dla POST membera: `initial_on_call_count = teams.max_saved_count` (snapshot w momencie dodania).

#### `public.members`
Wykorzystywane pola:
- `member_id`, `team_id`, `display_name`, `initial_on_call_count`, `created_at`, `updated_at`, `deleted_at`

Zapytania (proponowane):
- GET list:
  - `select ... from members where team_id = <teamId>` + filtr:
    - `status=active` → `deleted_at is null`
    - `status=all` → brak filtra `deleted_at`
  - sort:
    - `createdAt` → `order(created_at, order)`
    - `displayName` → `order(display_name, order)`
  - pagination:
    - limit/offset + pobranie `total` (patrz sekcja wydajności).
- POST create:
  - `insert into members (team_id, display_name, initial_on_call_count) values (...) returning *`
- PATCH update:
  - `update members set display_name = ... where team_id = <teamId> and member_id = <memberId> and deleted_at is null returning *`
  - (rekomendacja) nie pozwalać edytować soft-deleted.
- DELETE soft-delete:
  - najpierw SELECT sprawdzający istnienie i `deleted_at`
  - jeśli `deleted_at is not null` → 409
  - wpp `update members set deleted_at = now() where ... and deleted_at is null returning *`

## 5. Względy bezpieczeństwa

### 5.1 Autentykacja i autoryzacja
- **401** dla braku sesji.
- **Brak `teamId` w API**: klient nie przekazuje tenant id, minimalizuje ryzyko IDOR.
- **IDOR na `memberId`**: wszystkie operacje na `{memberId}` muszą być ograniczone do `team_id` ustalonego na podstawie `userId`.

### 5.2 RLS / polityki Supabase
- Docelowo dostęp do `members` powinien być chroniony przez RLS (polityki powiązane z `teams.owner_id = auth.uid()`).
- Uwaga operacyjna: w repo istnieje migracja usuwająca polityki RLS (`20260127221108_disable_rls_policies.sql`). Jeśli zostanie zastosowana przy włączonym RLS, zapytania z kluczem anon będą domyślnie blokowane dla `anon/authenticated`.
- Plan wdrożenia powinien zawierać decyzję środowiskową:
  - **Opcja A (zalecana)**: utrzymywać polityki RLS i wykonywać zapytania jako użytkownik (JWT na request).
  - **Opcja B**: backend używa `service_role` (tylko serwer), wtedy konieczna jest dodatkowa walidacja tenantów po stronie serwera (bo RLS jest omijane).

### 5.3 Walidacja danych i twarde granice
- Walidować i normalizować `displayName` (trim, min/max).
- Walidować parametry listy (limit/max, offset/min, enumy).
- Nie zwracać surowych błędów DB (unikamy wycieków implementacyjnych).


## 6. Obsługa błędów

### 6.1 Mapowanie walidacji (Zod → HTTP)
- **400 Bad Request**:
  - query/body/path nie spełnia schematów
  - `error.code = "validation_error"`
  - `error.details` zawiera listę pól i komunikatów

### 6.2 Mapowanie domenowe i DB → HTTP
- **401 Unauthorized**:
  - brak użytkownika z `supabase.auth.getUser()`
  - `error.code = "unauthorized"`
- **404 Not Found**:
  - PATCH/DELETE: brak rekordu w obrębie teamu użytkownika
  - `error.code = "not_found"`
- **409 Conflict**:
  - DELETE: member już soft-deleted (`deleted_at != null`)
  - `error.code = "conflict"`
- **422 Unprocessable Entity** (POST):
  - brak warunków do utworzenia członka, np. użytkownik nie ma teamu → nie da się ustalić `initialOnCallCount`
  - `error.code = "unprocessable_entity"`
- **500 Internal Server Error**:
  - nieoczekiwane wyjątki, błędy Supabase, błędy mapowania
  - `error.code` np. `"unprocessable_entity"` lub bardziej szczegółowy kod serwerowy (bez wycieków).

### 6.3 Logowanie błędów
- W schemacie DB nie ma dedykowanej tabeli błędów; `public.events` ma ograniczony `event_type` i nie nadaje się do logowania błędów API dla members.
- Rejestrować błędy serwerowe przez `console.error` (lub docelowo integracja typu Sentry), z metadanymi:
  - endpoint + metoda,
  - `userId` (jeśli dostępne),
  - `teamId` (jeśli ustalone),
  - `memberId` (jeśli dotyczy),
  - bez logowania tokenów/sekretów/pełnych payloadów wrażliwych.


## 8. Kroki implementacji

1. **Ustalić model autentykacji dla API (warunek krytyczny)**
   - Zdecydować, czy frontend przekazuje `Authorization: Bearer <jwt>` do endpointów API, czy wdrażamy cookie-based SSR.
   - Zapewnić, że `context.locals.supabase` jest per-request clientem z kontekstem użytkownika (JWT/cookies), aby `supabase.auth.getUser()` i RLS działały poprawnie.

2. **Dodać/zweryfikować Zod**
   - Upewnić się, że `zod` jest dependency w `package.json`.
   - Przyjąć wspólny format błędów: `ApiErrorResponse` + spójne `error.code`.

3. **Zdefiniować schematy walidacji**
   - Plik: `src/lib/validation/members.schema.ts`
     - `membersListQuerySchema` (status/limit/offset/sort/order; defaulty; clamp max 200)
     - `createMemberSchema` (`displayName`)
     - `updateMemberSchema` (`displayName`)
     - `memberIdParamSchema` (UUID)

4. **Dodać serwis members**
   - Plik: `src/lib/services/members.service.ts`
   - Implementacja:
     - `getTeamIdForUser(userId)` (lokalnie lub przez `team.service.ts`)
     - `listMembers(...)`
     - `createMember(...)`:
       - pobierz `team.max_saved_count`
       - insert member z `initial_on_call_count = max_saved_count`
     - `updateMember(...)`:
       - update po `(team_id, member_id)` i `deleted_at is null`
     - `softDeleteMember(...)`:
       - pre-check `deleted_at` (409) + update ustawiający `deleted_at = now()`
   - Mapper:
     - `toMemberDto(db: DbMember): MemberDto` (w serwisie lub `src/lib/mappers/member.mapper.ts`).

5. **Zaimplementować endpointy Astro**
   - `src/pages/api/members/index.ts`:
     - `GET`: auth → walidacja query → `membersService.listMembers` → 200 (`ApiListResponse<MemberDto>`)
     - `POST`: auth → parse JSON → walidacja body → `membersService.createMember` → 201 (`ApiDataResponse<MemberDto>`)
   - `src/pages/api/members/[memberId].ts`:
     - `PATCH`: auth → walidacja `memberId` + body → `membersService.updateMember` → 200
     - `DELETE`: auth → walidacja `memberId` → `membersService.softDeleteMember` → 204

6. **Wspólne helpery HTTP (rekomendowane)**
   - Plik: `src/lib/http/responses.ts` i `src/lib/http/errors.ts`
     - helpery do budowania `Response` i `ApiErrorResponse` (400/401/404/409/422/500).

7. **Checklist testów (minimum)**
   - GET:
     - bez auth → 401
     - status=active → tylko `deletedAt=null`
     - status=all → zawiera soft-deleted
     - limit/offset/sort/order → poprawna paginacja i stabilne sortowanie
   - POST:
     - błędne body → 400
     - brak teamu → 422
     - poprawne body → 201 i `initialOnCallCount` równe `team.maxSavedCount`
   - PATCH:
     - memberId nie-uuid → 400
     - member nie istnieje / nie w teamie → 404
     - member soft-deleted → 404 (rekomendacja)
   - DELETE:
     - nie istnieje → 404
     - usuń aktywnego → 204
     - usuń ponownie → 409

