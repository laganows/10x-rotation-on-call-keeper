# API Endpoint Implementation Plan: Profile (`/api/profile`)

## 1. Przegląd punktu końcowego
Zestaw endpointów do zarządzania profilem aktualnie zalogowanego użytkownika. Obsługuje odczyt profilu, idempotentne utworzenie profilu oraz aktualizację pola `displayName`. Dane są mapowane na tabelę `public.profiles`, powiązaną 1:1 z `auth.users`.

## 2. Szczegóły żądania
- Metoda HTTP i URL:
  - `GET /api/profile`
  - `POST /api/profile`
  - `PATCH /api/profile`
- Parametry:
  - Wymagane: brak parametrów URL lub query
  - Opcjonalne: brak
- Request Body:
  - `POST`:
    - `{ "displayName": "string|null" }` (wymagane pole, dopuszcza `null`)
  - `PATCH`:
    - `{ "displayName": "string|null" }` (wymagane pole, dopuszcza `null`)

## 3. Wykorzystywane typy
- DTO:
  - `ProfileDto`
  - `ApiDataResponse<ProfileDto>`
  - `ApiErrorResponse`
- Command modele:
  - `CreateProfileCommand`
  - `UpdateProfileCommand`
- Typy DB:
  - `DbProfile`
  - `UserId`

## 4. Szczegóły odpowiedzi
- `GET /api/profile`
  - `200 OK` + `ApiDataResponse<ProfileDto>`
  - `401 Unauthorized` jeśli brak sesji użytkownika
  - `404 Not Found` jeśli profil nie istnieje
  - `500 Internal Server Error` dla błędów serwera
- `POST /api/profile`
  - `201 Created` + `ApiDataResponse<ProfileDto>` przy utworzeniu
  - `200 OK` + `ApiDataResponse<ProfileDto>` jeśli profil już istnieje (idempotentnie)
  - `400 Bad Request` przy nieprawidłowym body
  - `401 Unauthorized` jeśli brak sesji użytkownika
  - `409 Conflict` tylko w przypadku nieobsłużonego konfliktu unikalności (powinien być obsłużony i mapowany na `200`)
  - `500 Internal Server Error` dla błędów serwera
- `PATCH /api/profile`
  - `200 OK` + `ApiDataResponse<ProfileDto>` po aktualizacji
  - `400 Bad Request` przy nieprawidłowym body
  - `401 Unauthorized` jeśli brak sesji użytkownika
  - `404 Not Found` jeśli profil nie istnieje
  - `500 Internal Server Error` dla błędów serwera

## 5. Przepływ danych
1. Endpoint pobiera klienta Supabase z `context.locals.supabase` (bez bezpośredniego importu klienta).
2. Uwierzytelnienie:
   - `supabase.auth.getUser()`; brak użytkownika → `401`.
3. Walidacja wejścia (Zod):
   - `POST`/`PATCH`: `displayName` obecne w body i typu `string | null`.
4. Logika serwisowa (wydzielona do `src/lib/services/profile.service.ts`):
   - `getProfileByUserId(userId)` → SELECT z `public.profiles`.
   - `createProfile(userId, displayName)` → INSERT.
   - `updateProfile(userId, displayName)` → UPDATE.
5. Mapowanie encji DB do `ProfileDto` i zwrot `ApiDataResponse`.
6. Błędy Supabase mapowane do `ApiErrorResponse` z odpowiednim kodem i statusem.

## 6. Względy bezpieczeństwa
- Wymagane uwierzytelnienie sesji Supabase; brak sesji → `401`.
- Użytkownik nie może przekazywać `userId` w body; `userId` pochodzi wyłącznie z sesji.
- Zastosować RLS na `public.profiles` (select/insert/update tylko dla własnego `user_id`).
- Walidacja wejścia Zod i odrzucenie nieprawidłowych danych (`400`).
- Brak ujawniania szczegółów błędów DB w odpowiedzi; logowanie serwerowe dla diagnostyki.

## 7. Obsługa błędów
- Walidacja wejścia:
  - `POST`/`PATCH` z nieprawidłowym body → `400` i `ApiErrorResponse` z `code: "validation_error"`.
- Uwierzytelnienie:
  - Brak użytkownika → `401` i `code: "unauthorized"`.
- Nie znaleziono profilu:
  - `GET`/`PATCH` gdy profil nie istnieje → `404` i `code: "not_found"`.
- Konflikt unikalności:
  - `POST` równoczesne utworzenie profilu → przechwycić konflikt, wykonać ponowny odczyt i zwrócić `200` (zamiast `409`).
- Błędy serwera:
  - Nieoczekiwane wyjątki lub błędy Supabase → `500` i `code: "unprocessable_entity"` lub niestandardowy kod.
- Rejestrowanie błędów:
  - Brak dedykowanej tabeli błędów w schemacie DB; logować po stronie serwera (np. `console.error`) z korelacją `userId` i kontekstem endpointu.

## 9. Kroki implementacji
1. Utworzyć schematy Zod w `src/lib/validation/profile.schema.ts`:
   - `createProfileSchema`, `updateProfileSchema`.
2. Dodać serwis w `src/lib/services/profile.service.ts`:
   - `getProfileByUserId`, `createProfile`, `updateProfile` z mapowaniem do `ProfileDto`.
3. Zaimplementować endpoint w `src/pages/api/profile.ts`:
   - `export const prerender = false`.
   - Handlery `GET`, `POST`, `PATCH` (uppercase).
   - Guard clauses: brak sesji → `401`; walidacja → `400`; brak profilu → `404`.
4. Obsłużyć idempotentność `POST`:
   - Najpierw SELECT; jeśli brak, INSERT.
   - Jeśli INSERT zwróci konflikt, wykonaj SELECT i zwróć `200`.
5. Zunifikować odpowiedzi:
   - Sukces: `ApiDataResponse<ProfileDto>`.
   - Błąd: `ApiErrorResponse` z właściwym `code`.
6. Przygotować przykładowe payloady do ręcznego testu:
   - `GET` bez sesji, `GET` z istniejącym/nieistniejącym profilem.
   - `POST` z `displayName: null`, `POST` powtórzone (idempotencja).
   - `PATCH` z poprawnym i błędnym body.
7. Zweryfikować polityki RLS dla `public.profiles` i dopasować do użycia w endpointach.
