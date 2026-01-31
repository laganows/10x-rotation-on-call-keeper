# Architektura UI dla Rotation On‑Call Keeper (ROCK)

## 1. Przegląd struktury UI

ROCK (MVP) to aplikacja webowa typu „single-user / single-team”, w której **najważniejszy jest Generator** (home) i deterministyczny flow: **Generate → Review → Save**. Interfejs jest mapowany 1:1 do zasobów domenowych i endpointów API, z minimalną nawigacją top‑level:

- Generator (home)
- Members
- Unavailabilities
- Plans

W MVP **brak osobnego ekranu Profile/Settings**; informacje o użytkowniku i Logout są w headerze. Po zalogowaniu aplikacja wykonuje „bootstrap danych” (`/api/profile`, `/api/team`) i w razie braków (404) wyświetla prosty ekran setup (uzupełnienie profilu/team), po którym użytkownik trafia do Generatora.

Kluczowe założenia UX / a11y / security:

- **Login gate**: niezalogowany użytkownik widzi wyłącznie ekran logowania; wszystkie pozostałe trasy są chronione.
- **Daty liczone wg UTC**: walidacje w UI spójne z backendem (startDate ≥ today UTC, 1–365 dni). UI wyjaśnia to komunikatem i tooltipem.
- **Spójne stany**: każdy widok ma przewidywalne stany loading/empty/error + retry.
- **Obsługa błędów API**: 400/422 inline (przy polach), 401 global redirect do logowania, 409 inline kontekstowo (np. konflikt zakresu przy Save), 5xx/network jako globalny banner/toast z Retry.
- **Responsywność**: desktop‑first; na mobile dopuszczalny poziomy scroll tabel (Generator/Plans) zamiast przebudowy na karty.
- **Dostępność (baseline WCAG)**: pełna obsługa klawiaturą, focus ring, semantyczne tabele (thead/th), aria-live dla toastów i błędów, sensowne opisy pól i przycisków.

## 2. Lista widoków

Poniżej lista widoków wraz z routingiem, celami, informacjami, komponentami oraz wymaganiami UX/a11y/security.

### 2.1. Login

- **Nazwa widoku**: Login
- **Ścieżka widoku**: `/login`
- **Główny cel**: Umożliwić zalogowanie przez Supabase Auth i wejście do aplikacji.
- **Kluczowe informacje do wyświetlenia**:
  - Krótki opis aplikacji („Rotation On‑Call Keeper”).
  - Informacja, że dostęp wymaga logowania.
- **Kluczowe komponenty widoku**:
  - Primary CTA: „Zaloguj się” (OAuth).
  - Obsługa stanu logowania (loading) i błędów (toast + retry).
- **UX, dostępność i bezpieczeństwo**:
  - Po wykryciu aktywnej sesji: natychmiastowy redirect do `/` (Generator).
  - Brak publicznego dostępu do danych; żadnych linków do chronionych tras.
  - a11y: przycisk jako `<button>`, focus ring, aria-live dla komunikatów.

### 2.2. App Shell (layout + globalna nawigacja)

- **Nazwa widoku**: App Shell (Layout)
- **Ścieżka widoku**: wrapper dla wszystkich tras chronionych (`/*` poza `/login`)
- **Główny cel**: Zapewnić spójny układ, nawigację, obsługę sesji i globalnych stanów błędów.
- **Kluczowe informacje do wyświetlenia**:
  - Nazwa produktu.
  - Informacja o użytkowniku (displayName lub email) + akcja Logout.
  - Ewentualny stan „offline” / błąd globalny.
- **Kluczowe komponenty widoku**:
  - Topbar z:
    - Nav: Generator, Members, Unavailabilities, Plans.
    - Sekcja użytkownika: label + Logout.
  - Outlet na content widoku.
  - Globalny system toastów / bannerów.
- **UX, dostępność i bezpieczeństwo**:
  - 401 zawsze → redirect do `/login` (bez zapamiętywania ostatniej trasy w MVP).
  - a11y: „skip to content”, aktywna pozycja nav czytelnie oznaczona, klawiaturowa nawigacja w nav.

### 2.3. Bootstrap / Setup (gdy brak Profile i/lub Team)

- **Nazwa widoku**: Setup (Bootstrap missing data)
- **Ścieżka widoku**: `/setup` (lub stan wewnątrz App Shell przed wejściem do głównych widoków)
- **Główny cel**: Uzupełnić brakujące rekordy po loginie (idempotentnie) i odblokować aplikację.
- **Zależności API**:
  - GET `/api/profile` (404 → brak profilu)
  - POST `/api/profile` (idempotentnie)
  - GET `/api/team` (404 → brak team)
  - POST `/api/team` (idempotentnie)
- **Kluczowe informacje do wyświetlenia**:
  - Wyjaśnienie: „Dokończ konfigurację, aby korzystać z aplikacji”.
  - Pola:
    - Profil: `displayName` (opcjonalne, max length, trim).
    - Team: `name` (wymagane).
- **Kluczowe komponenty widoku**:
  - Formularz „Setup” (jedno- lub dwu‑sekcyjny: Profile + Team).
  - CTA: „Zapisz i przejdź do Generatora”.
  - Obsługa błędów inline (400/422) i retry.
- **UX, dostępność i bezpieczeństwo**:
  - Brak „Anuluj” w MVP (żeby nie zostawiać użytkownika w nieużywalnym stanie); alternatywnie tylko Logout.
  - a11y: etykiety pól, opisy walidacji, fokus na pierwszym błędnym polu.

### 2.4. Generator (Preview + Save) — Home

- **Nazwa widoku**: Generator
- **Ścieżka widoku**: `/`
- **Główny cel**: Wygenerować deterministyczny preview planu w zadanym zakresie i umożliwić zapis planu.
- **Zależności API**:
  - POST `/api/plans/preview` (Generate)
  - POST `/api/plans` (Save)
  - (pośrednio) GET `/api/members` oraz GET `/api/unavailabilities` są zarządzane w swoich widokach; Generator nie musi ich pobierać, o ile backend preview opiera się na danych serwera.
- **Kluczowe informacje do wyświetlenia**:
  - Kontrolki zakresu: `startDate`, `endDate` (UTC), z informacją „Daty liczone wg UTC”.
  - Wynik preview:
    - `rangeDays`
    - Lista przypisań: `day` → `memberId|null (UNASSIGNED)`
    - Liczniki per członek: `savedCount`, `previewCount`, `effectiveCount`
    - Nierówność: `inequality.historical` i `inequality.preview` (max-min)
    - Dni `UNASSIGNED`: alert z liczbą + listą dat (kopiowalny tekst)
  - Stany: loading generacji, błąd walidacji, błąd sieci, brak danych.
- **Kluczowe komponenty widoku**:
  - Sekcja „Zakres”:
    - DateRangeForm (z sync do query params `?start=YYYY-MM-DD&end=YYYY-MM-DD`)
    - Tooltip „UTC” z przykładem różnicy stref
  - Primary CTA: „Generate preview”
  - Sekcja „Review” (renderowana po sukcesie):
    - Alert UNASSIGNED (jeśli występuje)
    - Tabela preview (semantyczna, z nagłówkami)
    - Panel liczników per member (tabela lub list)
    - Kafle/metryki fairness (historical vs preview)
  - Sekcja „Save”:
    - Primary CTA „Save plan”
    - Inline error dla 409 („Zakres nakłada się na istniejący plan”)
  - Kontekstowe linki pomocnicze:
    - „Add members” → `/members` (np. gdy brak członków)
    - „Add unavailabilities” → `/unavailabilities`
- **UX, dostępność i bezpieczeństwo**:
  - **Save aktywne tylko po wygenerowaniu preview w bieżącej sesji**; zmiana dat dezaktywuje Save i usuwa „gotowość do zapisu”.
  - Preview jest **stanem lokalnym + cache po (startDate,endDate)**; po refresh UI może ponowić Generate dla tych samych parametrów.
  - Walidacje:
    - startDate/endDate wymagane, poprawny format
    - \(1 \le\) rangeDays \(\le 365\)
    - startDate ≥ today UTC
  - Błędy:
    - 400/422: inline przy polach dat + opis
    - 409 (Save): inline w sekcji Save; UI zostaje na ekranie i zachowuje preview
    - 401: redirect do `/login`
  - a11y: wyraźne nagłówki sekcji (Generate/Review/Save), aria-live dla komunikatów, focus management po błędzie.

### 2.5. Members

- **Nazwa widoku**: Members
- **Ścieżka widoku**: `/members`
- **Główny cel**: Zarządzać członkami (CRUD + soft-delete) i pokazać ich liczniki fairness.
- **Zależności API**:
  - GET `/api/members` (domyślnie active, opcja all)
  - POST `/api/members`
  - PATCH `/api/members/{memberId}`
  - DELETE `/api/members/{memberId}` (soft-delete)
- **Kluczowe informacje do wyświetlenia**:
  - Lista członków z kolumnami:
    - `displayName`
    - `savedCount` (wymagane w kontrakcie API)
    - `initialOnCallCount`
    - status (Active/Removed)
  - Przełącznik „Active / All” (domyślnie Active).
  - Wyszukiwanie po `displayName` + sort `displayName` asc (minimum w MVP).
- **Kluczowe komponenty widoku**:
  - Toolbar:
    - Search input
    - Toggle Active/All
    - CTA „Add member”
  - Tabela members (semantyczna) + actions:
    - Edit (dla aktywnych)
    - Remove (soft-delete, dla aktywnych; z potwierdzeniem)
  - Dialog/Drawer:
    - Add member form
    - Edit member form
- **UX, dostępność i bezpieczeństwo**:
  - Soft-deleted widoczni tylko w „All” jako „Removed”, read-only (bez akcji).
  - 404 przy edycji/usuwaniu: komunikat, odśwież listę.
  - 409 przy usuwaniu (jeśli backend blokuje): inline przy akcji.
  - a11y: dialog z trap focus, opis konsekwencji soft-delete, klawiaturowa obsługa tabeli.

### 2.6. Unavailabilities

- **Nazwa widoku**: Unavailabilities
- **Ścieżka widoku**: `/unavailabilities`
- **Główny cel**: Przeglądać i zarządzać niedostępnościami w zakresie dat; dodawanie jest idempotentne.
- **Zależności API**:
  - GET `/api/unavailabilities?startDate&endDate&memberId?`
  - POST `/api/unavailabilities?onConflict=ignore`
  - DELETE `/api/unavailabilities/{unavailabilityId}`
  - (pomocniczo) GET `/api/members` do listy członków w filtrze i formularzu
- **Kluczowe informacje do wyświetlenia**:
  - Zakres dat (domyślnie today UTC → +30 dni) + presety 7/30/90/365.
  - Filtr `memberId` (opcjonalny).
  - Lista wpisów: `day`, członek, akcja delete.
- **Kluczowe komponenty widoku**:
  - Toolbar:
    - Date range (start/end)
    - Presets (zmieniają endDate względem startDate)
    - Select member (filter)
    - CTA „Add unavailability”
  - Formularz dodania:
    - Member select
    - Day picker / input `YYYY-MM-DD`
    - Submit (POST z `onConflict=ignore`)
  - Tabela unavailabilities:
    - sort day asc
    - akcja Delete (z potwierdzeniem)
- **UX, dostępność i bezpieczeństwo**:
  - Duplikaty: UI traktuje dodanie jako sukces (idempotentnie), bez przełącznika dla użytkownika.
  - Walidacje:
    - dzień w formacie `YYYY-MM-DD`
    - (preferencyjnie) ograniczenie w UI do today..today+365, spójnie z regułami planowania; w razie rozbieżności backend zwróci 400/422.
  - a11y: formularz z opisami, tabele semantyczne, aria-live dla potwierdzeń dodania/usunięcia.

### 2.7. Plans (lista)

- **Nazwa widoku**: Plans (List)
- **Ścieżka widoku**: `/plans`
- **Główny cel**: Przeglądać zapisane plany i przechodzić do szczegółów.
- **Zależności API**:
  - GET `/api/plans`
- **Kluczowe informacje do wyświetlenia**:
  - Lista planów:
    - `startDate`, `endDate`
    - `createdAt` (opcjonalnie)
  - Stany: empty (brak planów), loading, error + retry.
- **Kluczowe komponenty widoku**:
  - Tabela planów z linkami do szczegółów (`/plans/:planId`).
  - (Opcjonalnie) filtry zakresu w przyszłości; w MVP można pominąć.
- **UX, dostępność i bezpieczeństwo**:
  - a11y: linki w tabeli, nagłówki kolumn, czytelny focus.

### 2.8. Plan detail (nagłówek + assignments)

- **Nazwa widoku**: Plan detail
- **Ścieżka widoku**: `/plans/:planId`
- **Główny cel**: Wyświetlić zapisany, nieedytowalny plan wraz z przypisaniami.
- **Zależności API**:
  - GET `/api/plans/{planId}` (header)
  - GET `/api/plans/{planId}/assignments` (lista przypisań)
  - (opcjonalnie dla zakładki Stats) GET `/api/stats/plans/{planId}`
- **Kluczowe informacje do wyświetlenia**:
  - Nagłówek planu: `startDate`, `endDate`, `createdAt`.
  - Tabela przypisań: `day` → `memberId|null`, z czytelnym „UNASSIGNED”.
  - (Opcjonalnie) statystyki per plan: days total/weekdays/weekends/unassigned, min/max/inequality, byMember.
- **Kluczowe komponenty widoku**:
  - Skeleton/loading states per request (header i assignments niezależnie).
  - Error states per request + retry.
  - Tabela assignments z poziomym scroll na mobile.
  - Sekcja UNASSIGNED (alert z listą dni), analogicznie jak w Generatorze.
- **UX, dostępność i bezpieczeństwo**:
  - 404: czytelny komunikat „Plan nie istnieje” + link do `/plans`.
  - a11y: semantyczna tabela, nagłówki, aria-live dla błędów i retry.

### 2.9. Stats (opcjonalnie, poza top‑nav)

- **Nazwa widoku**: Stats
- **Ścieżka widoku**:
  - Preferencyjnie jako zakładka w Plans (`/plans?tab=stats` lub sekcja na `/plans`) albo jako osobny widok `/stats` bez umieszczania w top‑nav.
- **Główny cel**: Pokazać globalne statystyki dyżurów i nierówność.
- **Zależności API**:
  - GET `/api/stats` (global)
  - GET `/api/stats/plans/{planId}` (per plan — jeśli w detail)
- **Kluczowe informacje do wyświetlenia**:
  - `days.total`, `days.weekdays`, `days.weekends`, `days.unassigned`
  - `members.min`, `members.max`, `members.inequality`
  - `byMember[]`
- **Kluczowe komponenty widoku**:
  - Kafle metryk + tabela byMember.
  - Filtr scope (global vs per plan) zależnie od miejsca osadzenia.
- **UX, dostępność i bezpieczeństwo**:
  - a11y: metryki jako definicje/sekcje z czytelnymi opisami, tabela byMember semantyczna.

## 3. Mapa podróży użytkownika

### 3.1. Najważniejszy przypadek użycia: wygeneruj i zapisz plan (US‑009, US‑010, US‑011, US‑012)

1. Użytkownik wchodzi na aplikację:
   - jeśli niezalogowany → `/login`
   - jeśli zalogowany → App Shell
2. Bootstrap po loginie:
   - UI odpytuje `/api/profile` i `/api/team`
   - jeśli 404 dla któregoś → `/setup` i uzupełnienie danych
3. Użytkownik trafia do **Generatora** (`/`):
   - Ustawia `startDate` i `endDate` (lub korzysta z wartości w URL `?start&end`)
   - Klik „Generate preview”
4. UI wykonuje POST `/api/plans/preview`:
   - success → sekcja Review:
     - tabela dzień→osoba/UNASSIGNED
     - liczniki per member + fairness (history vs preview)
     - alert UNASSIGNED (jeśli występuje)
   - 400/422 → błędy inline w polach dat (i opis „daty wg UTC”)
   - 401 → redirect `/login`
   - network/5xx → globalny toast/banner + Retry
5. Użytkownik (opcjonalnie) przechodzi do:
   - `/members` aby dodać członków, jeśli preview jest słabe / puste
   - `/unavailabilities` aby dodać niedostępności
6. Po review użytkownik klika „Save plan”:
   - UI wykonuje POST `/api/plans` z assignments z preview
   - success → komunikat „Zapisano” + redirect do `/plans` lub do `/plans/:planId` (decyzja UX; w MVP preferencyjnie do listy)
   - 409 → inline błąd „Zakres nakłada się” + pozostanie w Generatorze; preview zostaje
   - 400/422 → inline błąd (np. niekompletne assignments)
7. Użytkownik może przejrzeć zapis:
   - `/plans` → wybór planu → `/plans/:planId`

### 3.2. Zarządzanie członkami (US‑002, US‑003, US‑004, US‑005, US‑015)

1. `/members` → lista aktywnych
2. „Add member” → POST `/api/members` → member pojawia się na liście
3. „Edit” → PATCH `/api/members/{memberId}` → update nazwy
4. „Remove” → DELETE `/api/members/{memberId}` → znika z Active, widoczny w All jako „Removed”
5. Użytkownik wraca do Generatora i generuje ponownie

### 3.3. Zarządzanie niedostępnościami (US‑006, US‑007, US‑008)

1. `/unavailabilities` domyślnie pokazuje today UTC → +30 dni
2. Dodanie:
   - wybór member + day → POST `/api/unavailabilities?onConflict=ignore`
   - sukces nawet przy duplikacie (idempotentnie)
3. Usunięcie:
   - delete na rekordzie → DELETE `/api/unavailabilities/{unavailabilityId}`
4. Powrót do Generatora i Generate

### 3.4. Przegląd zapisanych planów i statystyk (US‑013, US‑014)

1. `/plans` → lista planów
2. `/plans/:planId` → szczegóły (header + assignments)
3. (Opcjonalnie) statystyki globalne i/lub per plan jako zakładka/sekcja

## 4. Układ i struktura nawigacji

### 4.1. Nawigacja top‑level (MVP)

- Stała globalna nawigacja w App Shell:
  - **Generator** (`/`) — domyślny ekran po loginie
  - **Members** (`/members`)
  - **Unavailabilities** (`/unavailabilities`)
  - **Plans** (`/plans`)

### 4.2. Nawigacja kontekstowa w Generatorze (flow)

Generator prowadzi użytkownika przez 3 stany:

- **Generate**: ustaw daty i uruchom preview
- **Review**: oceń tabelę, fairness i unassigned; opcjonalne linki do Members/Unavailabilities
- **Save**: zapis planu (aktywny tylko gdy istnieje aktualny preview)

### 4.3. URL jako stan (deep-linking)

- Generator przechowuje daty w query params:
  - `/?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Dzięki temu:
  - back/forward działa przewidywalnie
  - możliwy jest refresh bez utraty kontekstu dat
  - preview może zostać odtworzony przez ponowne Generate dla tych samych parametrów

### 4.4. Header użytkownika

- W headerze:
  - displayName (fallback: email)
  - Logout (jedno kliknięcie)
- Brak osobnego Settings w MVP.

## 5. Kluczowe komponenty

Poniższe komponenty/wzorce są używane wielokrotnie i definiują spójność UX:

- **AuthGate / RouteGuard**: ochrona tras, wykrycie 401, redirect do `/login`.
- **BootstrapLoader**: cichy bootstrap `/api/profile` + `/api/team`; routing do `/setup` gdy 404.
- **ApiErrorPresenter**: ujednolicony rendering błędów (inline vs global) na podstawie statusu i znormalizowanego shape `code/message/details`.
- **DateRangePicker (UTC)**:
  - wejście/wyjście w `YYYY-MM-DD`
  - wbudowana walidacja zakresu 1–365 i startDate ≥ today UTC
  - tooltip „Daty wg UTC”
- **DataTable (A11y-first)**:
  - semantyczne `<table>`, `<thead>`, `<th scope="col">`
  - wsparcie poziomego scroll na mobile
  - spójne stany empty/loading/error
- **UnassignedAlert**:
  - liczba dni UNASSIGNED + lista dat (kopiowalna)
  - wspólna dla Generator i Plan detail
- **MemberCountersPanel**:
  - prezentacja `savedCount`, `previewCount`, `effectiveCount`
  - wspólna dla Generator (review) i potencjalnie dla przyszłych statystyk
- **ConfirmDialog**:
  - potwierdzenie destructive actions (soft-delete member, delete unavailability)
  - trap focus + aria-describedby

## 6. Stany brzegowe i błędy (wspólne zasady)

- **401 Unauthorized**: globalnie redirect `/login` (MVP bez „return to last route”).
- **400/422 Validation error**:
  - inline przy formularzach (Generator dates, Setup, Add/Edit member, Add unavailability)
  - focus na pierwsze pole z błędem
- **409 Conflict**:
  - Save plan w Generatorze: twarda blokada; UI zostaje na ekranie, preview zachowane; podświetlenie pól dat opcjonalne
  - pozostałe konflikty (jeśli wystąpią): inline przy akcji
- **404 Not found**:
  - `/api/profile` lub `/api/team`: prowadzi do Setup
  - `/api/plans/:planId`: widok „Plan nie istnieje” + link do listy
- **Empty states**:
  - brak members: Generator pokazuje callout „Dodaj members”
  - brak plans: Plans list pokazuje prosty empty state i link do Generatora
- **UNASSIGNED**:
  - zawsze traktowane jako „osobna kategoria” w tabelach
  - alert wyświetlany tylko gdy występują dni unassigned
- **Zmiany danych poza Generator**:
  - w MVP brak wykrywania „stale preview” po zmianie Members/Unavailabilities; komunikowane najwyżej jako ograniczenie (post‑MVP).

## 7. Zgodność z API (mapowanie widok → endpointy)

- **Login**: (Supabase Auth) + brak bezpośrednich endpointów domenowych
- **Bootstrap/Setup**:
  - GET/POST `/api/profile`
  - GET/POST `/api/team`
- **Generator**:
  - POST `/api/plans/preview`
  - POST `/api/plans`
- **Members**:
  - GET/POST `/api/members`
  - PATCH/DELETE `/api/members/{memberId}`
- **Unavailabilities**:
  - GET `/api/unavailabilities`
  - POST `/api/unavailabilities?onConflict=ignore`
  - DELETE `/api/unavailabilities/{unavailabilityId}`
  - GET `/api/members` (dla selectów/filtrów)
- **Plans list**:
  - GET `/api/plans`
- **Plan detail**:
  - GET `/api/plans/{planId}`
  - GET `/api/plans/{planId}/assignments`
  - (opcjonalnie) GET `/api/stats/plans/{planId}`
- **Stats (opcjonalnie)**:
  - GET `/api/stats`

## 8. Mapowanie historyjek użytkownika (PRD) do architektury UI

- **US‑001 (Logowanie/wylogowanie)**:
  - Widoki: Login, App Shell (header user + Logout), AuthGate
- **US‑002 (Lista członków)**:
  - Widok: Members (Active domyślnie), tabela z `savedCount` i `initialOnCallCount`
- **US‑003 (Dodanie członka)**:
  - Widok: Members → dialog Add member
- **US‑004 (Edycja członka)**:
  - Widok: Members → dialog Edit (tylko displayName)
- **US‑005 (Soft‑delete członka)**:
  - Widok: Members → Remove (confirm dialog), filtr Active/All, „Removed” read-only
- **US‑006 (Dodanie niedostępności)**:
  - Widok: Unavailabilities → Add (idempotentnie)
- **US‑007 (Usunięcie niedostępności)**:
  - Widok: Unavailabilities → Delete (confirm dialog)
- **US‑008 (Przegląd niedostępności)**:
  - Widok: Unavailabilities → zakres + filtr memberId + sort day asc
- **US‑009 (Generowanie grafiku)**:
  - Widok: Generator → Generate preview + deterministyczny wynik + UNASSIGNED
- **US‑010 (Podgląd i liczniki)**:
  - Widok: Generator → Review (tabela + liczniki + fairness + alert UNASSIGNED)
- **US‑011 (Zapisywanie planu)**:
  - Widok: Generator → Save plan; potem Plans list/detail
- **US‑012 (Konflikt zakresu)**:
  - Widok: Generator → inline 409 na Save, bez przełączania ekranu
- **US‑013 (Lista planów)**:
  - Widok: Plans list + Plan detail
- **US‑014 (Statystyki)**:
  - Widok: Stats (opcjonalnie) jako zakładka w Plans lub osobny ekran poza top‑nav
- **US‑015 (Dodanie nowej osoby a wyrównanie startowe)**:
  - Widok: Members — ekspozycja `initialOnCallCount` + `savedCount` dla przejrzystości
- **US‑016 (Nierówność historyczna i podglądu)**:
  - Widok: Generator — metryki `inequality.historical` i `inequality.preview` jako wartości + krótki opis
- **US‑017 (Obsługa UNASSIGNED)**:
  - Widoki: Generator i Plan detail — „UNASSIGNED” w tabeli + alert z listą dni
- **US‑018 (Walidacja zakresu dat)**:
  - Widok: Generator — walidacje inline + komunikacja UTC
- **US‑019 (Deterministyczny tie‑breaker)**:
  - Widok: Generator — komunikat w help/tooltip („Wynik deterministyczny; remisy rozstrzygane stałym porządkiem”)
- **US‑020 (Instrumentacja zdarzeń)**:
  - UI: brak osobnego widoku w MVP; zdarzenia są generowane przez backend przy preview/save (UI zapewnia `durationMs` dla Save).

## 9. Mapowanie wymagań na elementy UI (cross‑cutting)

- **Deterministyczność** → Generator: stały flow, brak ręcznych korekt, jasna komunikacja „deterministyczny preview”.
- **Sprawiedliwość / fairness** → Generator: liczniki i nierówność (historical vs preview); Members: widoczne `savedCount` i `initialOnCallCount`.
- **Skala 50 członków / 365 dni** → tabele z możliwością przewijania, brak paginacji w MVP, czytelne stany loading.
- **Brak ról** → uproszczony header użytkownika + Logout, bez Settings.
- **RLS / izolacja danych** → UI nie implementuje „team switch”; wszystko w kontekście jednego team po `/api/team`.

## 10. Potencjalne punkty bólu i jak UI je adresuje

- **Niejasne strefy czasowe**:
  - Stała informacja „Daty liczone wg UTC” + tooltip z przykładem różnicy.
- **Brak danych wejściowych (brak members / dużo UNASSIGNED)**:
  - Generator: callouty „Add members” / „Add unavailabilities” oraz alert UNASSIGNED z listą dni.
- **Konflikt planów (409)**:
  - Generator: jasny błąd inline + zachowanie preview; użytkownik zmienia daty i generuje ponownie.
- **Nieprzewidywalne błędy API**:
  - Spójne stany error + retry; 401 global redirect; 5xx/network global banner/toast.

