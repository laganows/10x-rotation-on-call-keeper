# Plan Testów – Rotation On-Call Keeper (ROCK)

## 1. Wprowadzenie i cele testowania

### 1.1 Wprowadzenie

Niniejszy dokument definiuje kompleksowy plan testów dla aplikacji **Rotation On-Call Keeper (ROCK)** – deterministycznej, zorientowanej na sprawiedliwość aplikacji webowej do generowania i zapisywania codziennych harmonogramów dyżurów on-call.

ROCK umożliwia Tech Leadom i właścicielom on-call automatyzację planowania dyżurów z uwzględnieniem:
- Deterministycznego przydziału członków zespołu do dyżurów
- Sprawiedliwego rozkładu obciążenia (fairness)
- Śledzenia niedostępności członków zespołu
- Niemutowalnych zapisanych planów

### 1.2 Cele testowania

| Cel | Opis |
|-----|------|
| **Weryfikacja funkcjonalna** | Potwierdzenie, że wszystkie funkcjonalności działają zgodnie ze specyfikacją PRD |
| **Walidacja integracji** | Sprawdzenie poprawnej współpracy między komponentami: Frontend (Astro + React), API i Supabase |
| **Zapewnienie bezpieczeństwa** | Weryfikacja mechanizmów autentykacji, autoryzacji i polityk RLS |
| **Ocena jakości UX** | Sprawdzenie dostępności (a11y), responsywności i użyteczności interfejsu |
| **Weryfikacja determinizmu** | Potwierdzenie, że ten sam input zawsze generuje ten sam harmonogram |
| **Ocena wydajności** | Weryfikacja czasów odpowiedzi API i renderowania komponentów |

---

## 2. Zakres testów

### 2.1 Zakres objęty testami

#### Moduły funkcjonalne

| Moduł | Priortet | Opis |
|-------|----------|------|
| **Autentykacja** | Krytyczny | Login, rejestracja, sesje, logout |
| **Profil użytkownika** | Wysoki | Tworzenie/edycja profilu |
| **Zarządzanie zespołem** | Wysoki | Tworzenie i aktualizacja zespołu |
| **Członkowie zespołu** | Krytyczny | CRUD, soft-delete, liczniki |
| **Niedostępności** | Krytyczny | CRUD, walidacja dat |
| **Generator planów** | Krytyczny | Podgląd, przydziały, metryki sprawiedliwości |
| **Zarządzanie planami** | Krytyczny | Zapisywanie, lista, szczegóły, blokowanie nakładania |
| **Statystyki** | Średni | Globalne i per-plan |
| **Instrumentacja** | Niski | Zdarzenia, analityka |

#### Warstwy techniczne

- **Frontend**: Komponenty Astro, React, routing, stan aplikacji
- **API**: Endpointy REST, walidacja Zod, obsługa błędów
- **Backend**: Serwisy domenowe, logika biznesowa
- **Baza danych**: Schemat PostgreSQL, constrainty, RLS
- **Integracje**: Supabase Auth, SSR

### 2.2 Zakres wyłączony z testów

- Wielozespołowość (multi-tenancy) – nie jest w MVP
- Preferencje/wagi, kalendarze świąt, wagi weekendów
- Edycja/usuwanie zapisanych planów
- Zamiany dyżurów, workflow zatwierdzania
- Eksporty i integracje zewnętrzne (PagerDuty, Slack, Calendar)
- Testy penetracyjne (wymagają osobnego procesu)

---

## 3. Typy testów do przeprowadzenia

### 3.1 Testy jednostkowe (Unit Tests)

**Cel**: Weryfikacja poprawności izolowanych jednostek kodu

#### Obszary objęte

| Obszar | Przykładowe przypadki |
|--------|----------------------|
| **Walidacja Zod** | Schematy: `loginSchema`, `registerSchema`, `members.schema`, `plans.schema`, `unavailabilities.schema` |
| **Funkcje pomocnicze** | `todayUtcYyyyMmDd()`, `diffDaysInclusive()`, `addDaysToYyyyMmDd()`, `isValidYyyyMmDd()` |
| **Mapowanie danych** | `mapMemberToDto()`, `mapPlanToDto()`, `mapUnavailabilityToDto()` |
| **Logika biznesowa** | `computeInequality()`, `buildStatsDays()`, `classifyDay()` |
| **Algorytm generatora** | `enumerateDays()`, `dateRangeDays()`, logika sortowania po effectiveCount |

#### Wymagane pokrycie

- Minimum **80%** pokrycia kodu dla modułów krytycznych (`lib/services/`, `lib/validation/`)
- **100%** pokrycia dla funkcji deterministycznych algorytmu generatora

### 3.2 Testy integracyjne (Integration Tests)

**Cel**: Weryfikacja współpracy między komponentami systemu

#### Obszary objęte

| Integracja | Scenariusze |
|------------|-------------|
| **API ↔ Serwisy** | Endpointy wywołują poprawne serwisy z właściwymi parametrami |
| **Serwisy ↔ Supabase** | Poprawność zapytań SQL, obsługa błędów bazy |
| **Frontend ↔ API** | Hook'i (`useMembersList`, `usePlanPreview`, etc.) poprawnie komunikują się z API |
| **Middleware ↔ Auth** | Weryfikacja sesji, przekierowania, blokowanie dostępu |
| **RLS Policies** | Użytkownicy mają dostęp tylko do swoich danych |

### 3.3 Testy end-to-end (E2E Tests)

**Cel**: Weryfikacja kompletnych ścieżek użytkownika w przeglądarce

#### Scenariusze priorytetowe

1. Pełny cykl: rejestracja → konfiguracja → dodanie członków → dodanie niedostępności → generowanie → zapisanie planu → sprawdzenie statystyk
2. Logowanie i wylogowanie
3. Edycja i usuwanie członków zespołu
4. Filtrowanie i paginacja list

#### Stabilność testów (kontrola flake)

- Stabilne selektory: używać `data-testid` / `data-test` zamiast selektorów CSS zależnych od layoutu.
- Diagnostyka: włączać `trace` i screenshoty na retry (Playwright) oraz archiwizować artefakty w CI.
- Retry z umiarem: ograniczyć liczbę retry i traktować je jako sygnał niestabilności, nie “naprawę”.
- Izolacja danych: każdy test (lub suite) powinien działać na odseparowanych danych (np. osobny użytkownik / osobny team) lub na deterministycznym seedzie.
- Determinizm: unikać zależności od czasu lokalnego przeglądarki; w miarę możliwości zamrażać czas / pracować na datach UTC.

### 3.4 Testy wizualne i regresji UI (Visual Regression Tests)

**Cel**: Wykrywanie niezamierzonych zmian w wyglądzie interfejsu

#### Komponenty objęte

- Formularze (login, rejestracja, dodawanie członków)
- Tabele (lista członków, niedostępności, przydziały planu)
- Widok generatora (podgląd, metryki, liczniki)
- Widok statystyk

### 3.5 Testy dostępności (Accessibility Tests)

**Cel**: Weryfikacja zgodności z WCAG 2.1 AA

#### Obszary objęte

- Nawigacja klawiaturą
- Atrybuty ARIA (`aria-label`, `aria-invalid`, `aria-live`, `role="alert"`)
- Kontrast kolorów
- Semantyczna struktura HTML
- Oznaczenia formularzy (`<Label>`, `htmlFor`)

### 3.6 Testy wydajnościowe (Performance Tests)

**Cel**: Weryfikacja czasów odpowiedzi i renderowania

#### Metryki docelowe

| Metryka | Cel |
|---------|-----|
| API response time (P95) | < 500ms |
| Time to First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Generowanie planu (365 dni) | < 3s |

#### Narzędzia (rekomendowane / opcjonalne)

- **Frontend**: Lighthouse (manual) lub Lighthouse CI (gating w PR).
- **API**: k6 (P95/P99 pod obciążeniem) lub prostszy smoke/perf test w Vitest/Hurl.
- **E2E**: Playwright + pomiar czasów krytycznych ścieżek (ostrożnie — podatne na flake).

### 3.7 Testy bezpieczeństwa (Security Tests)

**Cel**: Weryfikacja mechanizmów ochrony danych i dostępu

#### Scenariusze

- Próba dostępu do danych innego użytkownika (RLS bypass)
- Walidacja tokenów JWT
- Ochrona przed XSS i CSRF
- Bezpieczne przechowywanie sesji (cookie options)

#### Uwagi dot. CSRF (zależnie od modelu sesji)

- Jeśli API opiera się o **cookies wysyłane automatycznie przez przeglądarkę**, ochrona CSRF powinna być jawnie przetestowana.
- Jeśli API używa wyłącznie nagłówka **`Authorization: Bearer ...`** (token trzymany po stronie klienta), ryzyko CSRF jest zwykle niższe, a większy nacisk należy położyć na **XSS** i sposób przechowywania tokenu/sesji.

#### Automatyzacja bezpieczeństwa w CI/CD (rekomendowane minimum)

- **SCA (zależności)**: GitHub Dependabot (lub Snyk) + okresowe `npm audit` jako smoke-check.
- **SAST**: Semgrep (reguły dla TS/React/Node) uruchamiany na PR.
- **Sekrety**: secret scanning (repo + CI) oraz blokowanie przypadkowych commitów kluczy.
- **DAST-lite (opcjonalnie)**: OWASP ZAP uruchamiany na środowisku staging.

### 3.8 Testy kontraktowe (Contract Tests)

**Cel**: Wczesne wykrywanie niekompatybilności między frontendem a API (DTO, kody błędów, shape odpowiedzi) zanim trafią do E2E.

#### Podejścia

- **Pact**: klasyczne contract testing (consumer-driven) — dobre przy większej liczbie klientów API.
- **Kontrakty Zod/TS**: traktowanie schematów (Zod) jako kontraktów i testowanie zgodności odpowiedzi API z tymi schematami (prostsze, “code-first”).

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1 Moduł Autentykacji

#### TC-AUTH-001: Logowanie z poprawnymi danymi
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Użytkownik zarejestrowany w systemie |
| **Kroki** | 1. Wejdź na `/login` 2. Wprowadź email 3. Wprowadź hasło 4. Kliknij "Zaloguj się" |
| **Oczekiwany rezultat** | Przekierowanie na `/`, sesja aktywna |

#### TC-AUTH-002: Logowanie z błędnym hasłem
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Kroki** | 1. Wejdź na `/login` 2. Wprowadź poprawny email 3. Wprowadź błędne hasło 4. Kliknij "Zaloguj się" |
| **Oczekiwany rezultat** | Komunikat "Nieprawidłowy email lub hasło", brak przekierowania |

#### TC-AUTH-003: Rejestracja nowego użytkownika
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Kroki** | 1. Wejdź na `/register` 2. Wprowadź email 3. Wprowadź hasło (min. 6 znaków) 4. Potwierdź hasło 5. Kliknij "Zarejestruj" |
| **Oczekiwany rezultat** | Konto utworzone, użytkownik zalogowany, przekierowanie na `/setup` |

#### TC-AUTH-004: Walidacja hasła przy rejestracji
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wejdź na `/register` 2. Wprowadź hasło krótsze niż 6 znaków 3. Spróbuj wysłać formularz |
| **Oczekiwany rezultat** | Błąd walidacji "password must be at least 6 characters" |

#### TC-AUTH-005: Sprawdzenie zgodności haseł
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wejdź na `/register` 2. Wprowadź różne hasła w polach "password" i "confirm password" |
| **Oczekiwany rezultat** | Błąd "passwords do not match" |

#### TC-AUTH-006: Dostęp do chronionej strony bez autoryzacji
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | `PUBLIC_AUTH_REQUIRED=true`, użytkownik niezalogowany |
| **Kroki** | 1. Próba wejścia na `/members` |
| **Oczekiwany rezultat** | Przekierowanie na `/login` |

#### TC-AUTH-007: Dostęp do chroninego API bez autoryzacji
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | `PUBLIC_AUTH_REQUIRED=true`, brak tokenu |
| **Kroki** | 1. Wywołaj GET `/api/members` bez nagłówka Authorization |
| **Oczekiwany rezultat** | HTTP 401, `{"error":{"code":"unauthorized"}}` |

---

### 4.2 Moduł Członków Zespołu

#### TC-MEM-001: Dodanie nowego członka
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Zalogowany użytkownik z zespołem |
| **Kroki** | 1. Wejdź na `/members` 2. Kliknij "Add member" 3. Wprowadź displayName 4. Kliknij "Create" |
| **Oczekiwany rezultat** | Członek dodany do listy, `initialOnCallCount` = `maxSavedCount` zespołu |

#### TC-MEM-002: Walidacja pustego displayName
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Otwórz formularz dodawania 2. Pozostaw pole displayName puste 3. Kliknij "Create" |
| **Oczekiwany rezultat** | Błąd "Display name is required" |

#### TC-MEM-003: Edycja członka
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Kliknij "Edit" przy istniejącym członku 2. Zmień displayName 3. Kliknij "Save changes" |
| **Oczekiwany rezultat** | Nazwa zaktualizowana, lista odświeżona |

#### TC-MEM-004: Soft-delete członka
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Kroki** | 1. Kliknij "Remove" przy członku 2. Potwierdź usunięcie |
| **Oczekiwany rezultat** | Członek ma `deletedAt`, nie pojawia się w filtrze "Active" |

#### TC-MEM-005: Wyświetlanie wszystkich członków (w tym usuniętych)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Zmień filtr Status na "All" |
| **Oczekiwany rezultat** | Lista zawiera zarówno aktywnych jak i usuniętych członków |

#### TC-MEM-006: Wyszukiwanie członków
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Wpisz fragment nazwy w polu Search |
| **Oczekiwany rezultat** | Lista filtrowana w czasie rzeczywistym |

---

### 4.3 Moduł Niedostępności

#### TC-UNA-001: Dodanie niedostępności
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Istnieje aktywny członek |
| **Kroki** | 1. Wejdź na `/unavailabilities` 2. Kliknij "Add unavailability" 3. Wybierz członka 4. Wybierz dzień 5. Kliknij "Add" |
| **Oczekiwany rezultat** | Niedostępność dodana, pojawia się na liście |

#### TC-UNA-002: Walidacja daty niedostępności (przeszłość)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Spróbuj dodać niedostępność na dzień w przeszłości (przed dziś UTC) |
| **Oczekiwany rezultat** | Błąd "Day must be between today and today+365 (UTC)" |

#### TC-UNA-003: Walidacja daty niedostępności (ponad 365 dni)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Spróbuj dodać niedostępność na dzień ponad 365 dni w przyszłości |
| **Oczekiwany rezultat** | Błąd walidacji |

#### TC-UNA-004: Duplikat niedostępności z onConflict=ignore
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Warunki wstępne** | Niedostępność już istnieje dla członka w danym dniu |
| **Kroki** | 1. Spróbuj dodać tę samą niedostępność |
| **Oczekiwany rezultat** | Bez błędu, zwrócona istniejąca niedostępność (idempotencja) |

#### TC-UNA-005: Usuwanie niedostępności
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Kliknij "Delete" przy niedostępności 2. Potwierdź |
| **Oczekiwany rezultat** | Niedostępność usunięta z listy |

#### TC-UNA-006: Filtrowanie zakresu dat
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Ustaw zakres dat 2. Sprawdź listę |
| **Oczekiwany rezultat** | Lista zawiera tylko niedostępności w wybranym zakresie |

---

### 4.4 Moduł Generatora Planów

#### TC-GEN-001: Generowanie podglądu planu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Istnieją aktywni członkowie |
| **Kroki** | 1. Wejdź na `/` (Generator) 2. Ustaw startDate i endDate 3. Kliknij "Generate preview" |
| **Oczekiwany rezultat** | Wyświetlona tabela przydziałów, liczniki członków, metryki fairness |

#### TC-GEN-002: Determinizm generatora
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Kroki** | 1. Wygeneruj podgląd dla zakresu X-Y 2. Odśwież stronę 3. Wygeneruj ponownie dla tego samego zakresu |
| **Oczekiwany rezultat** | Identyczne przydziały dla obu generacji |

#### TC-GEN-003: Obsługa niedostępności w generatorze
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Członek A ma niedostępność w dniu X |
| **Kroki** | 1. Wygeneruj plan zawierający dzień X |
| **Oczekiwany rezultat** | Członek A NIE jest przydzielony do dnia X |

#### TC-GEN-004: Dzień bez dostępnych członków (UNASSIGNED)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Wszyscy aktywni członkowie mają niedostępność w dniu X |
| **Kroki** | 1. Wygeneruj plan zawierający dzień X |
| **Oczekiwany rezultat** | Dzień X ma `memberId: null`, wyświetlany jako "UNASSIGNED", obecny w `unassignedDays` |

#### TC-GEN-005: Walidacja zakresu dat (start > end)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Ustaw startDate późniejszy niż endDate |
| **Oczekiwany rezultat** | Błąd "Start date must be before or equal to end date" |

#### TC-GEN-006: Walidacja zakresu dat (ponad 365 dni)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Ustaw zakres dłuższy niż 365 dni |
| **Oczekiwany rezultat** | Błąd "Date range must be between 1 and 365 days" |

#### TC-GEN-007: Walidacja startDate w przeszłości
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Ustaw startDate przed dzisiejszą datą UTC |
| **Oczekiwany rezultat** | Błąd "Start date must be today or later (UTC)" |

#### TC-GEN-008: Metryki inequality
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wygeneruj podgląd 2. Sprawdź wartości `historical` i `preview` inequality |
| **Oczekiwany rezultat** | Inequality = max(effectiveCount) - min(effectiveCount) dla wszystkich członków |

#### TC-GEN-009: Liczniki członków
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wygeneruj podgląd 2. Sprawdź wartości savedCount, previewCount, effectiveCount |
| **Oczekiwany rezultat** | `effectiveCount = initialOnCallCount + savedCount + previewCount` |

---

### 4.5 Moduł Zapisywania Planów

#### TC-SAVE-001: Zapisanie planu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Wygenerowany podgląd |
| **Kroki** | 1. Kliknij "Save plan" |
| **Oczekiwany rezultat** | Plan zapisany, przekierowanie na `/plans`, toast "Plan saved" |

#### TC-SAVE-002: Zapisanie planu aktualizuje savedCount
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Kroki** | 1. Zapisz plan 2. Sprawdź savedCount członków w `/members` |
| **Oczekiwany rezultat** | savedCount zwiększony o liczbę przydziałów |

#### TC-SAVE-003: Blokada zapisu planu nakładającego się
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Krytyczny |
| **Warunki wstępne** | Istnieje zapisany plan na zakres 01-07 |
| **Kroki** | 1. Wygeneruj podgląd na zakres 05-15 2. Spróbuj zapisać |
| **Oczekiwany rezultat** | Błąd "Date range overlaps with an existing plan" (HTTP 409) |

#### TC-SAVE-004: Blokada zapisu bez podglądu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wejdź na Generator bez generowania podglądu |
| **Oczekiwany rezultat** | Przycisk "Save plan" jest wyłączony (`disabled`) |

#### TC-SAVE-005: Blokada zapisu po zmianie zakresu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wygeneruj podgląd 2. Zmień zakres dat (bez ponownego generowania) |
| **Oczekiwany rezultat** | Przycisk "Save plan" jest wyłączony (podgląd nieaktualny) |

---

### 4.6 Moduł List Planów

#### TC-PLAN-001: Lista planów
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Warunki wstępne** | Istnieją zapisane plany |
| **Kroki** | 1. Wejdź na `/plans` |
| **Oczekiwany rezultat** | Lista planów z datami, paginacja |

#### TC-PLAN-002: Szczegóły planu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Kliknij na plan w liście |
| **Oczekiwany rezultat** | Widok `/plans/[planId]` z listą przydziałów i statystykami |

#### TC-PLAN-003: Paginacja przydziałów planu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Warunki wstępne** | Plan z >50 przydziałami |
| **Kroki** | 1. Sprawdź przyciski paginacji |
| **Oczekiwany rezultat** | Możliwość nawigacji między stronami |

---

### 4.7 Moduł Statystyk

#### TC-STATS-001: Globalne statystyki
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Wejdź na `/stats` |
| **Oczekiwany rezultat** | Wyświetlone: total days, weekdays, weekends, unassigned, inequality, per-member counts |

#### TC-STATS-002: Statystyki bez zapisanych planów
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Niski |
| **Warunki wstępne** | Brak zapisanych planów |
| **Kroki** | 1. Wejdź na `/stats` |
| **Oczekiwany rezultat** | Wartości zerowe lub komunikat "No member stats available yet" |

#### TC-STATS-003: Statystyki per-plan
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Wejdź na `/plans/[planId]` i sprawdź statystyki |
| **Oczekiwany rezultat** | Statystyki ograniczone do przydziałów danego planu |

---

### 4.8 Moduł Profilu i Zespołu

#### TC-SETUP-001: Konfiguracja początkowa (Setup)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Warunki wstępne** | Nowy użytkownik bez profilu i zespołu |
| **Kroki** | 1. Wejdź na `/setup` 2. Wprowadź displayName i nazwę zespołu 3. Zapisz |
| **Oczekiwany rezultat** | Profil i zespół utworzone, przekierowanie na główną stronę |

#### TC-PROFILE-001: Aktualizacja profilu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Wywołaj PATCH `/api/profile` z nowym displayName |
| **Oczekiwany rezultat** | Profil zaktualizowany, `updatedAt` zmieniony |

---

### 4.9 Testy API

#### TC-API-001: Odpowiedź 404 dla nieistniejącego zasobu
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wywołaj GET `/api/members/nieistniejacy-uuid` |
| **Oczekiwany rezultat** | HTTP 404, `{"error":{"code":"not_found"}}` |

#### TC-API-002: Walidacja body (błędne dane)
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Wysoki |
| **Kroki** | 1. Wywołaj POST `/api/members` z pustym body |
| **Oczekiwany rezultat** | HTTP 400, `{"error":{"code":"validation_error", "details":...}}` |

#### TC-API-003: Paginacja
| Atrybut | Wartość |
|---------|---------|
| **Priorytet** | Średni |
| **Kroki** | 1. Wywołaj GET `/api/members?limit=10&offset=0` |
| **Oczekiwany rezultat** | Odpowiedź zawiera `page: {limit, offset, total}` |

---

## 5. Środowisko testowe

### 5.1 Środowiska

| Środowisko | Cel | Baza danych | Supabase |
|------------|-----|-------------|----------|
| **Lokalne (Dev)** | Testy jednostkowe, integracyjne podczas developmentu | Supabase lokalny (CLI) | `supabase start` |
| **CI/CD** | Testy automatyczne w pipeline | Supabase lokalny w kontenerze | GitHub Actions |
| **Staging** | Testy E2E, UAT | Oddzielny projekt Supabase | Dedykowany tenant |
| **Produkcja** | Smoke testy post-deployment | Produkcyjny Supabase | Z ograniczeniami |

### 5.2 Konfiguracja środowiska

```bash
# Wymagane zmienne środowiskowe
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
PUBLIC_AUTH_REQUIRED=true

# Node.js
node --version  # 22.14.0 (zgodnie z .nvmrc)
```

### 5.3 Dane testowe

- **Fixtures**: Predefiniowane użytkownicy, zespoły, członkowie
- **Seed database**: Skrypty SQL do inicjalizacji danych testowych (najlepiej **idempotentne**; uruchamiane per-suite/per-job w CI)
- **Factories**: Generatory danych dla testów jednostkowych

---

## 6. Narzędzia do testowania

### 6.1 Rekomendowany stos narzędzi

| Kategoria | Narzędzie | Uzasadnienie |
|-----------|-----------|--------------|
| **Unit/Integration** | Vitest | Natywne wsparcie ESM, szybki, kompatybilny z Vite |
| **E2E** | Playwright | Multi-browser, auto-wait, screenshots, traces |
| **API Testing** | Bruno (manual) + Hurl/Newman/Vitest (CI) | Bruno dla eksploracji, CI-friendly scenariusze HTTP lub testy w TS |
| **Contract Testing** | Pact lub Zod (kontrakty DTO) | Wczesne wykrywanie niezgodności FE ↔ API |
| **Visual Regression** | Playwright Screenshots + Percy (page) / Chromatic (Storybook) | Integracja z CI; wybór zależny od podejścia do UI |
| **Accessibility** | axe-core + @axe-core/playwright | Automatyczne audyty a11y |
| **Coverage** | Vitest Coverage (provider: v8) | Pokrycie kodu (raporty dla CI) |
| **Mocking** | MSW + mock `api-client` | MSW dla testów integracyjnych UI, mock klienta dla unitów |
| **Database Testing** | Supabase CLI + custom seeds | Izolowane środowisko DB |
| **Security (CI)** | Dependabot/Snyk + Semgrep (+ opcj. ZAP) | Automatyczne wykrywanie ryzyk w zależnościach i kodzie |

### 6.2 Istniejąca infrastruktura testowa

Projekt zawiera kolekcję Bruno API (`/bruno/`) z testami manualnymi dla:
- Members CRUD
- Plans (preview, save, list)
- Unavailabilities CRUD
- Profile CRUD
- Team CRUD
- Stats

**Rekomendacja**:
- Zachować Bruno jako narzędzie do eksploracji i manualnego debugowania.
- Wybrać jedną ścieżkę automatyzacji w CI:
  - **Hurl** (tekstowe scenariusze HTTP, bardzo CI-friendly), lub
  - **Postman + Newman** (jeśli zespół już używa Postmana), lub
  - **Vitest (code-first)** — przeniesienie scenariuszy Bruno do testów TS, gdy testy mają wykorzystywać typy/Zod i logikę pomocniczą.

### 6.3 Kryteria wyboru (skrót)

- **Visual regression**:
  - Jeśli jest **Storybook** → Chromatic (komponenty, review w PR).
  - Jeśli brak Storybook → Percy (page-level) lub Playwright screenshots + proces baseline.
- **API testing w CI**:
  - Jeśli priorytet to prostota i czytelność → Hurl.
  - Jeśli priorytet to kompatybilność z Postmanem → Newman.
  - Jeśli priorytet to typy/kontrakty i reuse kodu → Vitest.

---

## 7. Harmonogram testów

### 7.1 Fazy testowania

| Faza | Czas trwania | Zakres | Odpowiedzialność |
|------|--------------|--------|------------------|
| **Przygotowanie** | 1 tydzień | Konfiguracja środowisk, setup narzędzi, tworzenie fixtures | QA Lead + DevOps |
| **Testy jednostkowe** | 2 tygodnie | Pisanie testów dla lib/services, lib/validation, hooks | Developerzy |
| **Testy integracyjne** | 2 tygodnie | API ↔ Serwisy ↔ DB, middleware, RLS | QA + Developerzy |
| **Testy E2E** | 2 tygodnie | Kluczowe ścieżki użytkownika | QA |
| **Testy a11y & visual** | 1 tydzień | Audyt dostępności, baseline screenshots | QA |
| **Testy wydajnościowe** | 1 tydzień | Benchmark API (np. k6), Lighthouse / Lighthouse CI | QA + DevOps |
| **Testy regresji** | Ciągłe | Automatyczne w CI/CD | CI Pipeline |
| **UAT** | 1 tydzień | Akceptacja przez stakeholdera | Product Owner |

### 7.2 Integracja z CI/CD

```yaml
# Przykład GitHub Actions workflow
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint

      # (Rekomendowane) Security: zależności i SAST
      # - SCA zwykle realizuje Dependabot/Snyk; tutaj można dodać prosty smoke-check:
      - name: Security - npm audit (smoke)
        run: npm audit --audit-level=high
      # - SAST (np. Semgrep) jako osobny job lub krok
      # - Secret scanning najczęściej na poziomie repo/CI
      
      - name: Start Supabase
        run: npx supabase start
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration

      # (Opcjonalnie) API testy HTTP poza Vitest (np. Hurl/Newman)
      # - name: Run API tests (Hurl)
      #   run: npm run test:api
      
      - name: Run E2E tests
        run: npm run test:e2e

      # (Opcjonalnie) Performance smoke (np. k6)
      # - name: Run k6 (smoke)
      #   run: npm run perf:smoke
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
```

---

## 8. Kryteria akceptacji testów

### 8.1 Kryteria wejścia (Entry Criteria)

- [ ] Środowisko testowe skonfigurowane i dostępne
- [ ] Wszystkie zależności zainstalowane
- [ ] Baza danych zainicjalizowana (migracje uruchomione)
- [ ] Kod źródłowy przetestowany przez linter bez błędów
- [ ] Dokumentacja testów dostępna

### 8.2 Kryteria wyjścia (Exit Criteria)

| Kryterium | Próg |
|-----------|------|
| **Pokrycie kodu (unit tests)** | ≥ 80% dla krytycznych modułów |
| **Testy jednostkowe** | 100% pass rate |
| **Testy integracyjne** | 100% pass rate |
| **Testy E2E** | ≥ 95% pass rate |
| **Błędy krytyczne** | 0 otwartych |
| **Błędy wysokie** | 0 otwartych |
| **Błędy średnie** | ≤ 5 otwartych z planem naprawy |
| **Testy a11y** | Brak naruszeń WCAG 2.1 AA |
| **Performance** | Wszystkie metryki w normie (sekcja 3.6) |

### 8.3 Definicja "Done" dla testów

- Przypadek testowy wykonany
- Rezultat udokumentowany (pass/fail)
- W przypadku fail: bug zgłoszony w systemie śledzenia
- Dowody wykonania (logi, screenshots) załączone
- Metryki pokrycia zaktualizowane

---

## 9. Role i odpowiedzialności w procesie testowania

### 9.1 Macierz RACI

| Aktywność | QA Lead | QA Engineer | Developer | DevOps | Product Owner |
|-----------|---------|-------------|-----------|--------|---------------|
| Planowanie testów | R | C | C | I | A |
| Pisanie testów jednostkowych | C | I | R | I | I |
| Pisanie testów integracyjnych | C | R | R | I | I |
| Pisanie testów E2E | C | R | C | I | I |
| Konfiguracja środowisk | C | I | C | R | I |
| Wykonanie testów manualnych | I | R | I | I | I |
| Raportowanie błędów | C | R | I | I | I |
| Naprawa błędów | I | C | R | C | I |
| Akceptacja UAT | C | C | C | I | R |
| Review wyników | R | C | C | C | A |

**Legenda**: R = Responsible, A = Accountable, C = Consulted, I = Informed

### 9.2 Opis ról

| Rola | Odpowiedzialności |
|------|-------------------|
| **QA Lead** | Planowanie testów, koordynacja zespołu QA, raportowanie statusu, decyzje o release |
| **QA Engineer** | Projektowanie i wykonanie testów, raportowanie błędów, automatyzacja |
| **Developer** | Pisanie testów jednostkowych, naprawa błędów, code review testów |
| **DevOps** | Konfiguracja CI/CD, środowiska testowe, monitoring |
| **Product Owner** | Akceptacja UAT, priorytety błędów, decyzja o gotowości produktu |

---

## 10. Procedury raportowania błędów

### 10.1 Szablon zgłoszenia błędu

```markdown
## Tytuł
[Moduł] Krótki opis problemu

## Środowisko
- Browser: Chrome 120
- OS: macOS 14.2
- Środowisko: Staging
- Użytkownik: test-user@example.com

## Kroki reprodukcji
1. Zaloguj się jako...
2. Przejdź do...
3. Wykonaj akcję...

## Oczekiwany rezultat
Opis co powinno się wydarzyć

## Aktualny rezultat
Opis co się faktycznie dzieje

## Dowody
- Screenshot/video: [załącznik]
- Logi konsoli: [załącznik]
- Network trace: [załącznik]

## Priorytet
[ ] Krytyczny - Blokuje główną funkcjonalność
[ ] Wysoki - Poważny wpływ na użytkowanie
[ ] Średni - Zauważalny problem z obejściem
[ ] Niski - Kosmetyczny lub edge case

## Przypadek testowy
Powiązany: TC-XXX-NNN
```

### 10.2 Cykl życia błędu

```
Nowy → Potwierdzony → W naprawie → Do weryfikacji → Zamknięty
         ↓                              ↓
     Odrzucony                     Ponownie otwarty
```

### 10.3 Priorytety i SLA

| Priorytet | Czas odpowiedzi | Czas naprawy | Przykład |
|-----------|-----------------|--------------|----------|
| **Krytyczny** | < 2h | < 24h | Brak możliwości logowania, utrata danych |
| **Wysoki** | < 8h | < 72h | Generator nie działa, błędne przydziały |
| **Średni** | < 24h | < 1 tydzień | Błąd walidacji, problem UI |
| **Niski** | < 48h | < 2 tygodnie | Literówka, usprawnienie UX |

### 10.4 Metryki raportowania

| Metryka | Opis | Cel |
|---------|------|-----|
| **Defect Density** | Błędy / KLOC | < 5 błędów/KLOC |
| **Defect Removal Efficiency** | Błędy znalezione przed release / wszystkie błędy | > 85% |
| **Test Case Effectiveness** | Błędy znalezione przez testy / wszystkie błędy | > 70% |
| **Mean Time to Detect** | Średni czas od wprowadzenia do wykrycia błędu | < 1 sprint |
| **Mean Time to Fix** | Średni czas naprawy błędu | Zgodny z SLA |

---

## 11. Załączniki

### 11.1 Matryca śledzenia wymagań (RTM)

| Wymaganie (PRD) | Scenariusze testowe | Priorytet |
|-----------------|---------------------|-----------|
| Deterministyczny generator | TC-GEN-002 | Krytyczny |
| Sprawiedliwy rozkład (fairness) | TC-GEN-008, TC-GEN-009 | Krytyczny |
| Obsługa niedostępności | TC-GEN-003, TC-GEN-004 | Krytyczny |
| Niemutowalne plany | TC-SAVE-001, TC-SAVE-003 | Krytyczny |
| Autentykacja | TC-AUTH-001 - TC-AUTH-007 | Krytyczny |
| CRUD członków | TC-MEM-001 - TC-MEM-006 | Krytyczny |
| CRUD niedostępności | TC-UNA-001 - TC-UNA-006 | Krytyczny |
| Statystyki | TC-STATS-001 - TC-STATS-003 | Średni |

### 11.2 Słownik terminów

| Termin | Definicja |
|--------|-----------|
| **effectiveCount** | `initialOnCallCount + savedCount + previewCount` - miara łącznego obciążenia członka |
| **inequality** | `max(effectiveCount) - min(effectiveCount)` - miara nierówności rozkładu |
| **UNASSIGNED** | Dzień bez dostępnych członków (`memberId: null`) |
| **soft-delete** | Logiczne usunięcie (ustawienie `deletedAt`) zamiast fizycznego usunięcia |
| **RLS** | Row Level Security - mechanizm Supabase ograniczający dostęp do danych |

---

