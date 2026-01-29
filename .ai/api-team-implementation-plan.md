### API Endpoint Implementation Plan: `/api/team` (GET, POST, PATCH)

## 1. Przegląd punktu końcowego
Endpoint `/api/team` obsługuje **zespół bieżącego użytkownika** (MVP: **1 użytkownik = 1 team**, wymuszone przez `UNIQUE(owner_id)` w `public.teams`).

- **GET `/api/team`**: pobiera team zalogowanego użytkownika.
- **POST `/api/team`**: tworzy team dla zalogowanego użytkownika (jeśli jeszcze nie istnieje).
- **PATCH `/api/team`**: aktualizuje nazwę teamu (bez możliwości zmiany `maxSavedCount`).

Backend: Astro Server Endpoints + Supabase (Postgres). Walidacja wejścia: **Zod**.

## 2. Szczegóły żądania

### Wspólne wymagania
- **Autentykacja**: użytkownik musi być zalogowany.
  - Źródło tożsamości: token sesji w `Authorization: Bearer <jwt>` (lub w cookies – jeśli zostanie wdrożone SSR/cookie auth).
- **Nagłówki**:
  - `Content-Type: application/json` dla POST/PATCH.

### GET `/api/team`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/api/team`
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne**: brak
- **Body**: brak

### POST `/api/team`
- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/team`
- **Parametry**:
  - **Wymagane**: brak (poza autentykacją)
  - **Opcjonalne**: brak
- **Request Body (Command Model)**: `CreateTeamCommand`
  - `name: string` (wymagane)

### PATCH `/api/team`
- **Metoda HTTP**: `PATCH`
- **Struktura URL**: `/api/team`
- **Parametry**:
  - **Wymagane**: brak (poza autentykacją)
  - **Opcjonalne**: brak
- **Request Body (Command Model)**: `UpdateTeamCommand`
  - `name: string` (wymagane)
- **Ograniczenie biznesowe**: brak bezpośredniej modyfikacji `maxSavedCount`.

## 3. Szczegóły odpowiedzi

### Sukces
Wspólna struktura danych (DTO): `TeamDto` opakowane w `ApiDataResponse<TeamDto>`.

- **200 OK**:
  - GET `/api/team` (znaleziono team)
  - PATCH `/api/team` (zaktualizowano team)
- **201 Created**:
  - POST `/api/team` (utworzono team)

### Błędy (standardowy envelope)
Zwracamy `ApiErrorResponse`:
- `error.code`: np. `validation_error`, `unauthorized`, `not_found`, `conflict`
- `error.message`: krótki opis
- `error.details`: opcjonalnie (np. pola walidacji)

Minimalny zestaw kodów wymagany przez wytyczne: **200, 201, 400, 401, 404, 500**.  
Dodatkowo zgodnie ze specyfikacją endpointu: **409** dla konfliktu przy tworzeniu teamu.

## 4. Przepływ danych

### Warstwa HTTP (Astro)
Plik: `src/pages/api/team.ts`
- `export const prerender = false`
- `export async function GET(context)`
- `export async function POST(context)`
- `export async function PATCH(context)`

Każdy handler:
1. Pobiera klienta Supabase z `context.locals.supabase` (zgodnie z zasadami projektu).
2. Ustala bieżącego użytkownika:
   - odczyt tokenu (np. `Authorization`),
   - weryfikacja przez Supabase Auth,
   - brak użytkownika → 401.
3. (POST/PATCH) Parsuje JSON body i waliduje Zod.
4. Wywołuje warstwę serwisową (logika domenowa + DB).
5. Mapuje encje DB (`DbTeam`) na `TeamDto`.
6. Zwraca odpowiedni status i body.

### Warstwa serwisowa (logika domenowa + DB)
Nowy serwis: `src/lib/services/team.service.ts` (lub analogicznie do innych serwisów w repo).

Odpowiedzialności serwisu:
- wykonywanie zapytań do tabeli `public.teams`
- mapowanie błędów Supabase/DB na błędy domenowe (np. “not found”, “conflict”)
- mapowanie do DTO (lub zwracanie `DbTeam` do handlera, a mapper w `src/lib/mappers`)

### Operacje DB (tabela `public.teams`)
Kolumny istotne dla endpointu:
- `team_id`, `owner_id`, `name`, `max_saved_count`, `created_at`, `updated_at`
Ograniczenia:
- `UNIQUE(owner_id)` (MVP: 1 team na właściciela)

Zapytania:
- **GET**: `select * from teams where owner_id = <userId> limit 1`
- **POST**: `insert into teams (owner_id, name) values (...) returning *`
  - wykrycie konfliktu (unikalność `owner_id`) → 409
- **PATCH**: `update teams set name = <name> where owner_id = <userId> returning *`
  - brak rekordu → decyzja:
    - preferowane: 404 (spójne z GET)
    - alternatywa (jeśli zakładamy, że team zawsze istnieje): 400 z komunikatem domenowym

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**:
  - Każdy request musi mieć zweryfikowanego użytkownika (401 w przeciwnym wypadku).
  - Rekomendacja: stworzyć per-request Supabase client z tokenem użytkownika w nagłówkach, aby RLS/polityki mogły działać.
- **Autoryzacja / izolacja tenantów**:
  - Endpoint nie przyjmuje `teamId` w URL ani w body; team jest zawsze “mój” → minimalizuje ryzyko IDOR.
  - Po stronie DB: docelowo RLS z predykatem `owner_id = auth.uid()`. Uwaga: w repo jest migracja usuwająca polityki RLS; to wpływa na dostęp.
- **Sekrety**:
  - Jeśli backend używa klucza `service_role`, nie wolno go ujawniać klientowi; trzymać tylko po stronie serwera (env).
  - Jeżeli używany jest klucz anon + RLS, konieczne jest przekazanie JWT użytkownika do Supabase przy zapytaniach.
- **Walidacja wejścia**:
  - Zod + ograniczenia długości i treści `name` (np. trim, min/max).
  - Ochrona przed nieprawidłowym JSON i typami (400).


## 6. Obsługa błędów

### Scenariusze błędów i kody
- **401 Unauthorized**:
  - brak tokenu / nieważny token / `supabase.auth.getUser()` zwraca brak użytkownika
- **400 Bad Request**:
  - body nie jest poprawnym JSON
  - walidacja Zod nie przechodzi (np. brak `name`, pusty string, zbyt długi)
  - (opcjonalnie) PATCH gdy brak teamu, jeśli zdecydujemy się nie używać 404
- **404 Not Found**:
  - GET: użytkownik nie ma teamu
  - (rekomendowane) PATCH: brak teamu do aktualizacji
- **409 Conflict**:
  - POST: próba utworzenia drugiego teamu dla tego samego `owner_id` (naruszenie `UNIQUE(owner_id)`)
- **500 Internal Server Error**:
  - nieoczekiwany błąd Supabase/DB/handlera

### Logowanie błędów
W schemacie DB nie ma tabeli “errors”, a `public.events` ma ograniczony `event_type`, więc:
- logujemy błędy serwerowe do `console.error` (z `requestId`, `userId` jeśli dostępne, bez wrażliwych danych),
- opcjonalnie w przyszłości: dodać tabelę `api_errors` lub rozszerzyć instrumentację (poza zakresem tego endpointu).

## 7. Wydajność
- **GET** i **PATCH**: 1 zapytanie `select/update returning`.
- **POST**: 1 zapytanie `insert returning`; konflikt wykrywany po kodzie błędu (bez dodatkowego `select`) → mniej RTT i bez race-condition.
- Indeksy: `UNIQUE(owner_id)` wspiera szybkie wyszukiwanie po `owner_id`.
- Payload mały (jeden rekord).

## 8. Kroki implementacji

1. **Doprecyzować model autentykacji dla API**
   - Ustalić, czy frontend będzie wysyłał `Authorization: Bearer <jwt>` do API, czy korzystamy z cookie-based SSR.
   - Jeżeli RLS ma działać: zapewnić, że zapytania do Supabase są wykonywane z kontekstem użytkownika (JWT w nagłówku/per-request client).

2. **Dodać zależność Zod**
   - Dodać `zod` do `package.json`.
   - Ustalić wspólny styl błędów walidacji (`ApiErrorResponse` z `validation_error` + `details`).

3. **(Rekomendowane) Uporządkować `context.locals.supabase` jako per-request client**
   - Zaktualizować `src/middleware/index.ts`, aby tworzyć klienta Supabase na request:
     - wyciągnąć token z nagłówka `Authorization`,
     - ustawić `global.headers.Authorization` na `Bearer <token>` (jeśli token jest obecny),
     - w przeciwnym wypadku pozostawić klienta bez tokenu.
   - Dzięki temu endpointy nie muszą tworzyć klienta samodzielnie i łatwiej egzekwować zasady projektu (“używaj supabase z locals”).

4. **Zaimplementować serwis `team.service.ts`**
   - `getTeamByOwnerId(userId): Promise<DbTeam | null>`
   - `createTeamForOwner(userId, name): Promise<DbTeam>` z obsługą konfliktu (mapa na błąd domenowy)
   - `updateTeamNameByOwnerId(userId, name): Promise<DbTeam | null>`
   - Wyodrębnić mapper `toTeamDto(dbTeam): TeamDto` (np. w serwisie lub osobnym module `src/lib/mappers/team.mapper.ts`).

5. **Dodać endpoint `src/pages/api/team.ts`**
   - `export const prerender = false`
   - `GET`:
     - autoryzacja → 401
     - serwis `getTeamByOwnerId` → null ⇒ 404
     - sukces ⇒ 200 + `ApiDataResponse<TeamDto>`
   - `POST`:
     - autoryzacja → 401
     - parse + Zod `CreateTeamCommand` → 400
     - serwis `createTeamForOwner`:
       - konflikt ⇒ 409
       - sukces ⇒ 201 + `ApiDataResponse<TeamDto>`
   - `PATCH`:
     - autoryzacja → 401
     - parse + Zod `UpdateTeamCommand` → 400
     - serwis `updateTeamNameByOwnerId`:
       - brak ⇒ rekomendowane 404
       - sukces ⇒ 200 + `ApiDataResponse<TeamDto>`

6. **Spójne mapowanie błędów Supabase → HTTP**
   - Zaimplementować małą warstwę helperów (np. `src/lib/http/errors.ts`):
     - `badRequest(message, details?)`
     - `unauthorized(message)`
     - `notFound(message)`
     - `conflict(message)`
     - `internalServerError(message)`
   - Upewnić się, że payload błędu zawsze jest `ApiErrorResponse`.

7. **Testy / weryfikacja (MVP)**
   - Testy integracyjne (jeśli brak infrastruktury testowej: przynajmniej checklist ręczny):
     - GET bez auth → 401
     - GET z auth i bez teamu → 404
     - POST z niepoprawnym body → 400
     - POST poprawny → 201 i zwraca `TeamDto`
     - POST ponownie → 409
     - PATCH zmienia `name`, nie zmienia `maxSavedCount` → 200

8. **Dokumentacja**
   - Uzupełnić README lub `.ai/api-plan.md` o informację, jak klient ma dostarczać token do API (Authorization vs cookies).
