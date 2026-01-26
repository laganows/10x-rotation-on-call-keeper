# Dokument wymagań produktu (PRD) - Rotation On‑Call Keeper (ROCK)

## 1. Przegląd produktu

Rotation On‑Call Keeper (ROCK) to aplikacja webowa umożliwiająca zespołom
technicznym szybkie, sprawiedliwe i deterministyczne planowanie dyżurów
on‑call. Projekt koncentruje się na podstawowych potrzebach: zarządzaniu
członkami zespołu i ich niedostępnościami, generowaniu rotacji dyżurów
dziennych (00:00–23:59) oraz zapisie planów. Główna wartość biznesowa
polega na automatycznym, uczciwym podziale odpowiedzialności, co ma
zapobiegać wypaleniu i zwiększać przejrzystość. W literaturze problem
sprawiedliwego harmonogramowania opisuje się poprzez różnicę między
obciążeniem pożądanym a rzeczywistym; największa z tych różnic określa
„niesprawiedliwość” systemu. Atlassian podkreśla,
że dobrze skonstruowany grafik on‑call zmniejsza obciążenie pracowników
i pomaga utrzymać zdrową kulturę pracy, dlatego harmonogramy powinny być
sprawiedliwe i skuteczne. ROCK realizuje te cele
poprzez prosty interfejs, deterministyczny algorytm i jasne raportowanie
statystyk.

MVP zakłada jednego zalogowanego użytkownika zarządzającego jednym
zespołem/projektem. Nie ma ról ani zaawansowanych integracji; priorytetem
jest poprawne działanie podstawowych funkcji (auth, CRUD, generator,
zapisywanie planu) w skali do 50 członków i zakresu planowania 1–365 dni.

## 2. Problem użytkownika

Tech Lead odpowiedzialny za dyżury on‑call musi przygotować grafik
uwzględniający urlopy, wydarzenia i równe rozłożenie obowiązków. Ręczne
planowanie bywa czasochłonne i obarczone błędami; trudno też zweryfikować,
czy podział jest uczciwy. Brak narzędzia może prowadzić do nierównych
obciążeń, co pogarsza morale i powoduje wypalenie zawodowe. Artykuł
Atlassian zwraca uwagę, że nieprzemyślane grafiki on‑call mogą być
„trudnym, pozbawiającym snu krokiem do wypalenia”, dlatego zaleca
strategię utrzymującą grafik w równowadze i efektywności.
Ponieważ nie istnieje oficjalny sposób na sprawiedliwe przydzielanie dyżurów,
ROCK dostarcza deterministyczny algorytm i widoczne statystyki, aby
zapewnić równość w długim okresie.

## 3. Wymagania funkcjonalne

### Autoryzacja i dostęp

* Uwierzytelnianie: logowanie i wylogowanie przez Supabase Auth (OAuth,
  np. GitHub). Dostęp do aplikacji jest możliwy wyłącznie po zalogowaniu.
* Brak ról i wielokrotnych kont w MVP – każdy zalogowany użytkownik ma pełen
  dostęp do funkcji.

### Zarządzanie członkami

* Lista członków: widok wszystkich aktywnych członków zespołu.
* Dodawanie członka: użytkownik wprowadza imię/nazwę, system tworzy
  immutable `memberId` (np. UUID) i przypisuje `initialOnCallCount` równy
  aktualnej maksymalnej liczbie dyżurów zapisanych w historii (`maxSavedCount`).
* Edycja członka: możliwość edycji danych prezentacyjnych (np. imienia);
  `memberId` i `initialOnCallCount` są niezmienialne.
* Usunięcie członka (soft‑delete): członek jest ukrywany z listy aktywnych,
  nie bierze udziału w nowych grafikach, ale jego historia pozostaje w
  zapisanych planach i statystykach. Przywracanie nie jest dostępne
  (powrót wymaga dodania nowego rekordu).

### Zarządzanie niedostępnościami

* Dodawanie niedostępności: użytkownik wybiera członka i datę (pojedynczy
  dzień) niedostępności; system wymusza unikalność pary (member, date).
* Duplikaty: w razie próby dodania duplikatu system zwraca błąd lub
  idempotentnie ignoruje zapis (do zdefiniowania w API).
* Usuwanie niedostępności: możliwość usunięcia pojedynczej daty
  niedostępności.
* Przegląd niedostępności: lista niedostępności w zadanym zakresie dat,
  filtrowalna po członku.

### Generator grafiku

* Wejście: `startDate` i `endDate` w formacie daty, zakres inkluzywny.
  Zakres musi mieścić się w przedziale 1–365 dni i zaczynać się nie
  wcześniej niż „dziś” (definicja „dziś” oparta na UTC; kwestia lokalnej
  strefy czasowej wymaga doprecyzowania).
* Algorytm deterministyczny:
  - Dla każdego dnia w zakresie generacji algorytm wybiera osobę o
    najmniejszym `effectiveCount = initialOnCallCount + savedCount + previewCount`.
  - Osoby z niedostępnością w danym dniu są pomijane.
  - Remisy rozstrzygane są stałym tie‑breakerem opartym na niezmiennym
    `memberId` (np. sortowanie alfabetyczne po UUID).
  - Jeśli nikt nie jest dostępny, wynik przypisania to `UNASSIGNED`.
* Podgląd (preview):
  - Tabela przedstawiająca każdy dzień i przypisanego członka lub
    `UNASSIGNED`.
  - Panel liczników per członek zawierający `savedCount`, `previewCount`,
    `effectiveCount`.
  - Obliczenie i prezentacja dwóch miar nierówności: historycznej
    nierówności (na podstawie samych `savedCount`) oraz nierówności
    podglądu (na podstawie `savedCount + previewCount`). Nierówność
    definiowana jest jako różnica między maksymalną a minimalną liczbą
    przypisanych dni.
  - Ostrzeżenie o dniach `UNASSIGNED` zawierające liczbę takich dni i
    listę dat.
* Generacja może być powtarzana wielokrotnie. Nie przewidziano ręcznych
  korekt pojedynczych przypisań, kopiowania planów ani eksportów w
  zakresie MVP.

### Zapisywanie planu

* Funkcja „Save plan” zapisuje podgląd jako nieedytowalny plan i utrwala
  przypisania dni w bazie danych.
* Przy zapisie sprawdzany jest konflikt zakresów: jeśli istnieje choć
  jeden zapisany plan nakładający się z wybranym zakresem, system
  odrzuca zapis i informuje użytkownika o konieczności zmiany zakresu.
* Zapisany plan aktualizuje `savedCount` dla członków i uaktualnia
  `maxSavedCount` do obliczeń w przyszłości.
* Plan po zapisie jest nieedytowalny. Nie ma możliwości jego usunięcia
  ani zmiany w ramach MVP.

### Widok planów i statystyk

* Lista zapisanych planów: wyświetla zakres dat, datę utworzenia, autora
  (użytkownik) oraz pozwala przejść do szczegółów planu.
* Statystyki:
  - Suma dni on‑call, podział na dni robocze i weekendy (weekend
    zdefiniowany jest jako sobota i niedziela w strefie UTC).
  - Liczba dni `UNASSIGNED` traktowanych jako osobna kategoria.
  - Wskaźnik nierówności: minimalna liczba dyżurów na członka,
    maksymalna liczba dyżurów oraz `inequality = max - min` dla
    aktywnych członków, zgodnie z definicją niesprawiedliwości w
    harmonogramowaniu.
* Statystyki mogą być prezentowane globalnie (dla całej historii) oraz
  per plan; szczegółowy zakres statystyk w MVP wymaga decyzji, aby nie
  rozbudowywać nadmiernie interfejsu.

### Instrumentacja i obsługa zdarzeń

* Przy generowaniu oraz zapisywaniu planu aplikacja zapisuje zdarzenie w
  bazie danych. Dla każdego zdarzenia rejestrowane są: typ
  (`plan_generated` lub `plan_saved`), identyfikator użytkownika,
  timestamp UTC, `startDate`, `endDate`, `rangeDays`, `membersCount`,
  `unassignedCount`, `inequality` (dla `plan_saved`) oraz czas
  trwania operacji.
* Metryka sukcesu „5 planów miesięcznie” obliczana jest jako liczba
  zdarzeń `plan_saved` w danym miesiącu (UTC). Analiza nierówności
  bazuje na wartości `inequality` zapisywanej przy `plan_saved`.

### Wymagania niefunkcjonalne

* **Deterministyczność:** ten sam zestaw wejściowy (zakres dat, lista
  członków, niedostępności, historia) zawsze generuje ten sam plan.
* **Wydajność:** generator powinien obsłużyć do 50 członków i 365 dni w
  czasie od ułamków sekundy do kilku sekund.
* **Skalowalność:** MVP zakłada jeden zespół i jednego użytkownika.
* **Bezpieczeństwo:** użycie Supabase RLS do ograniczenia dostępu
  wyłącznie do danych zalogowanego użytkownika.
* **Testy i CI:** minimalny zestaw testów (unit test algorytmu
  generującego oraz test integracyjny CRUD) uruchamiany w ramach
  GitHub Actions.

## 4. Granice produktu

* **Zakres użytkowników i zespołów:** MVP obsługuje jednego
  zalogowanego użytkownika i jeden zespół. Brak ról (administrator,
  członek) oraz brak możliwości posiadania wielu zespołów/projektów.
* **Zakres czasowy:** Planowanie obejmuje tylko dni od daty „dzisiaj”
  (UTC) do maksimum 365 dni wprzód. Nie można tworzyć planów w
  przeszłości. Start i koniec zakresu są inkluzywne. Wymagane jest
  doprecyzowanie definicji „dzisiaj” w kontekście stref czasowych.
* **Brak preferencji i wag:** Wersja MVP nie uwzględnia preferencji
  użytkowników, stawek, świąt, ważenia weekendów ani zaawansowanej
  optymalizacji. Weekend służy wyłącznie do statystyk.
* **Brak integracji:** Nie ma integracji z narzędziami typu PagerDuty,
  Slack, eksportu do kalendarza ani API do wymiany danych z innymi
  systemami.
* **Brak edycji planu:** Po zapisaniu planu nie można go modyfikować ani
  usuwać. Nie przewidziano mechanizmu zamian dyżurów, workflow
  akceptacji czy przywracania usuniętych członków (soft‑delete).
* **Model danych:** Decyzja, czy tworzyć jawny rekord zespołu w bazie,
  pozostaje otwarta; MVP może uprościć model do właściciela. Ma to
  wpływ na przyszłą rozbudowę i spójność RLS.
* **Unresolved issues:**
  - Definicja „dzisiaj” (data UTC vs. data lokalna) i sposób
    komunikacji w UI.
  - Zachowanie przy duplikatach niedostępności (błąd 409 vs. ignorowanie).
  - Dokładna definicja `savedCount` w kontekście nieaktywnych członków.
  - Zakres i szczegółowość widoku statystyk (globalne vs. per plan).
  - Struktura modelu danych dla „1 użytkownik, 1 zespół” (jawny rekord
    team/project czy uproszczony model).

## 5. Historyjki użytkowników

Każda historyjka opisuje funkcjonalność z perspektywy użytkownika i
zawiera kryteria akceptacji umożliwiające testowanie.

| ID | Tytuł | Opis | Kryteria akceptacji |
|----|-------|------|---------------------|
| **US‑001** | Logowanie i wylogowanie | Jako Tech Lead chcę się zalogować i wylogować, aby mieć bezpieczny dostęp do aplikacji. | 1. System udostępnia przycisk logowania za pomocą Supabase Auth (OAuth). 2. Po pomyślnym logowaniu użytkownik uzyskuje dostęp do wszystkich funkcji aplikacji. 3. Bez zalogowania żadna funkcja (lista członków, generator) nie jest dostępna. 4. Użytkownik może wylogować się w dowolnym momencie, co usuwa jego sesję. |
| **US‑002** | Przegląd listy członków | Jako Tech Lead chcę zobaczyć listę wszystkich aktywnych członków zespołu, aby znać skład zespołu. | 1. Po zalogowaniu użytkownik może przejść do widoku „Members”. 2. Lista wyświetla imię/nazwę każdego aktywnego członka oraz jego aktualny `savedCount` i `initialOnCallCount`. 3. Soft‑deleted członkowie są domyślnie ukryci z listy aktywnych. |
| **US‑003** | Dodanie nowego członka | Jako Tech Lead chcę dodać nowego członka zespołu, aby uwzględnić go w przyszłych dyżurach. | 1. Użytkownik podaje imię/nazwę członka i zatwierdza dodanie. 2. System generuje immutable `memberId` i ustawia `initialOnCallCount` na bieżący `maxSavedCount`. 3. Nowy członek pojawia się na liście aktywnych z `savedCount = 0` i `previewCount = 0`. |
| **US‑004** | Edycja danych członka | Jako Tech Lead chcę móc edytować dane wyświetlane członka, aby zachować aktualność informacji. | 1. Użytkownik może zmienić imię/nazwę członka w widoku edycji. 2. System nie pozwala zmienić `memberId` ani `initialOnCallCount`. 3. Zaktualizowane dane są widoczne w liście członków i w przyszłych planach. |
| **US‑005** | Usunięcie członka (soft‑delete) | Jako Tech Lead chcę usunąć członka, aby nie był uwzględniany w przyszłych grafikach. | 1. Użytkownik wybiera „usuń” przy członku. 2. System oznacza członka jako nieaktywny (soft‑delete) i przestaje uwzględniać go w generatorze. 3. Historia dyżurów dla usuniętego członka pozostaje w zapisanych planach i statystykach. 4. Nie istnieje opcja przywrócenia; przy powrocie należy dodać nowy rekord. |
| **US‑006** | Dodanie niedostępności | Jako Tech Lead chcę dodać dzień niedostępności dla członka, aby algorytm ominął go w danym dniu. | 1. Użytkownik wybiera członka i datę (pojedynczy dzień) niedostępności. 2. System sprawdza unikalność (member, date); duplikat powoduje błąd lub jest ignorowany zgodnie z API. 3. Niedostępność jest zapisywana i widoczna w zestawieniu niedostępności. |
| **US‑007** | Usunięcie niedostępności | Jako Tech Lead chcę usunąć niedostępność, która już nie obowiązuje, aby członek mógł brać dyżury w tym dniu. | 1. Użytkownik wybiera członka i konkretną datę niedostępności do usunięcia. 2. System usuwa wpis i aktualizuje listę niedostępności. 3. Usunięta niedostępność nie jest brana pod uwagę w kolejnych generacjach grafików. |
| **US‑008** | Przegląd niedostępności | Jako Tech Lead chcę przeglądać niedostępności członków w wybranym zakresie dat, aby planować z wyprzedzeniem. | 1. Użytkownik podaje zakres dat i otrzymuje listę niedostępności przypadających w tym okresie. 2. Lista może być filtrowana po konkretnym członku. 3. Wyświetlane są tylko daty niedostępności; brak wpisów oznacza pełną dostępność. |
| **US‑009** | Generowanie grafiku | Jako Tech Lead chcę wygenerować grafik dyżurów na wybrany zakres dat, aby zobaczyć, kto będzie pełnić dyżury. | 1. Użytkownik wprowadza `startDate` i `endDate` (inclusive). 2. System weryfikuje, że zakres wynosi 1–365 dni i nie zaczyna się przed „dziś” (UTC). 3. Algorytm przypisuje na każdy dzień osobę z najmniejszym `effectiveCount`, pomijając osoby niedostępne; remisy rozstrzygane są deterministycznie po `memberId`. 4. W dniach, w których nikt nie jest dostępny, system przypisuje `UNASSIGNED`. 5. Wygenerowany podgląd jest deterministyczny; ten sam input zawsze daje ten sam wynik. |
| **US‑010** | Podgląd grafiku i liczniki | Jako Tech Lead chcę zobaczyć podgląd przypisań i liczniki, aby ocenić równomierność podziału. | 1. Po wygenerowaniu grafiku system pokazuje tabelę z każdym dniem i przypisaną osobą lub `UNASSIGNED`. 2. Panel liczników per członek wyświetla `savedCount`, `previewCount` i `effectiveCount`. 3. System oblicza i wyświetla historyczną nierówność (`maxSavedCount - minSavedCount`) oraz nierówność podglądu (`max(effectiveCount) - min(effectiveCount)`). 4. Jeżeli występują dni `UNASSIGNED`, system wyświetla liczbę i listę dat tych dni. 5. Użytkownik może ponownie wygenerować grafik (nadpisując podgląd) lub przejść do zapisu. |
| **US‑011** | Zapisywanie planu | Jako Tech Lead chcę zapisać wygenerowany grafik jako plan, aby utrwalić przypisania dyżurów. | 1. Użytkownik wybiera akcję „Save plan” po wygenerowaniu podglądu. 2. System sprawdza, czy wybrany zakres dat nie koliduje z żadnym istniejącym planem. 3. Jeśli kolizja występuje, system odrzuca zapis i komunikuje błąd. 4. Jeżeli kolizji nie ma, system zapisuje plan jako nieedytowalny rekord, aktualizuje `savedCount` członków i `maxSavedCount`. 5. Zdarzenie `plan_saved` jest zapisane z informacjami analitycznymi. |
| **US‑012** | Obsługa konfliktu zakresów | Jako Tech Lead chcę być informowany, gdy próbuję zapisać plan nachodzący na istniejący plan, aby uniknąć nakładających się grafików. | 1. Przy próbie zapisu planu system porównuje zakres z zapisanymi planami. 2. Jeśli choć jeden dzień z zakresu występuje w zapisanym planie, system uniemożliwia zapis. 3. Komunikat o błędzie wskazuje powód i zachęca do zmiany zakresu. |
| **US‑013** | Przegląd zapisanych planów | Jako Tech Lead chcę zobaczyć listę wszystkich zapisanych planów, aby móc przeglądać historię dyżurów. | 1. Użytkownik może przejść do widoku „Plany”. 2. Lista pokazuje zakres dat każdego planu, datę utworzenia i autora. 3. Po wybraniu planu użytkownik może zobaczyć szczegółowe przypisania i statystyki dla tego planu. |
| **US‑014** | Statystyki | Jako Tech Lead chcę przeglądać statystyki dyżurów, aby ocenić obciążenie zespołu i nierówność podziału. | 1. Użytkownik może wyświetlić globalne statystyki (suma dni, weekendy, dni `UNASSIGNED`, min/max liczba dyżurów, `inequality = max - min`). 2. Statystyki można ograniczyć do pojedynczego planu lub do całej historii. 3. Weekend definiowany jest jako sobota i niedziela wg UTC. 4. Dni `UNASSIGNED` są wyświetlane i liczone oddzielnie. |
| **US‑015** | Dodanie nowej osoby a wyrównanie startowe | Jako Tech Lead chcę mieć pewność, że nowo dołączone osoby nie otrzymają nieproporcjonalnie wielu dyżurów, aby zachować sprawiedliwość w zespole. | 1. Przy dodawaniu nowego członka system ustawia `initialOnCallCount` na `maxSavedCount` z historii. 2. Ta wartość jest zamrożona i nie zmienia się automatycznie przy kolejnych zapisach planów. 3. Dzięki temu nowi członkowie mają taki sam „startowy” licznik jak pozostali i nie są faworyzowani w generatorze. |
| **US‑016** | Nierówność historyczna i podglądu | Jako Tech Lead chcę porównywać nierówność w historii i w podglądzie, aby ocenić wpływ generacji na sprawiedliwość. | 1. Podgląd grafiku pokazuje dwie wartości: historyczną nierówność (obliczoną na `savedCount`) i nierówność podglądu (obliczoną na `savedCount + previewCount`). 2. Nierówność definiowana jest jako `max - min` liczby dyżurów na aktywnego członka. 3. Wartości te są widoczne przed zapisem planu, co pozwala na ewentualne korekty (np. edycję niedostępności lub listy członków) przed finalizacją. |
| **US‑017** | Obsługa dni `UNASSIGNED` | Jako Tech Lead chcę widzieć informację o dniach, w których nikt nie był dostępny, aby móc podjąć działania korygujące. | 1. Podgląd grafiku wyraźnie oznacza każdy dzień `UNASSIGNED`. 2. Panel informacyjny pokazuje liczbę takich dni oraz listę dat. 3. Dni `UNASSIGNED` nie zwiększają liczników `savedCount` ani `previewCount`, ale są liczone w ogólnej liczbie dni i statystykach (jako osobna kategoria „Unassigned days”). |
| **US‑018** | Walidacja zakresu dat | Jako Tech Lead chcę otrzymywać komunikaty o błędach, gdy podaję nieprawidłowy zakres dat, aby uniknąć błędnych planów. | 1. Przy generowaniu planu system sprawdza, czy `startDate` i `endDate` są zdefiniowane i spełniają warunek 1–365 dni. 2. Jeśli zakres jest dłuższy niż 365 dni lub krótszy niż 1 dzień, system zwraca błąd. 3. Jeśli `startDate` znajduje się w przeszłości względem „dzisiaj” (UTC), system nie zezwala na generację. 4. Błędy są wyświetlane w sposób zrozumiały dla użytkownika. |
| **US‑019** | Deterministyczny tie‑breaker | Jako Tech Lead chcę mieć pewność, że algorytm zawsze wybierze tę samą osobę przy remisie, aby plan był powtarzalny. | 1. Przy remisie (równy `effectiveCount` i brak niedostępności) system rozstrzyga na podstawie stałego porządku po niezmiennym `memberId` (np. UUID). 2. Zmiana nazwy członka nie wpływa na kolejność. 3. Dzięki temu każde ponowne generowanie przy identycznych danych wejściowych daje identyczny wynik. |
| **US‑020** | Instrumentacja zdarzeń | Jako właściciel produktu chcę rejestrować zdarzenia generacji i zapisu planów, aby móc analizować użycie i mierzyć sukces produktu. | 1. Przy każdym wygenerowaniu planu system zapisuje zdarzenie `plan_generated` z danymi: użytkownik, timestamp UTC, `startDate`, `endDate`, `rangeDays`, `membersCount`, `unassignedCount`, czas wykonania. 2. Przy każdym zapisie planu system zapisuje zdarzenie `plan_saved` z tymi samymi danymi oraz wartością `inequality` (obliczoną dla planu). 3. Dane te można wykorzystać do raportowania (np. liczba zapisanych planów miesięcznie, średnia i maksymalna nierówność). |

## 6. Metryki sukcesu

Sukces projektu będzie oceniany według miar technicznych i produktowych.

### Metryki techniczne

* **Poprawne działanie:** aplikacja obsługuje logowanie, CRUD członków
  (wraz z soft‑delete), CRUD niedostępności, generator, podgląd i zapis
  planu oraz wyświetlanie statystyk. Każda funkcja jest pokryta
  podstawowymi testami jednostkowymi i integracyjnymi.
* **Deterministyczność:** algorytm generujący jest w pełni deterministyczny;
  te same dane wejściowe zawsze dają ten sam wynik. Remisy rozstrzygane
  są za pomocą stałego porządku po `memberId`.
* **Wydajność:** generowanie grafiku dla do 50 członków i 365 dni trwa
  ułamki sekundy do kilku sekund. W razie przekroczenia limitu czasowego
  (np. w testach CI) uznaje się błąd.
* **Skalowalność i bezpieczeństwo:** system obsługuje jednego
  zalogowanego użytkownika i jeden zespół. Dane są izolowane przez
  mechanizmy RLS Supabase.
* **Jakość kodu:** projekt korzysta z CI na GitHub Actions, gdzie
  uruchamiane są testy i weryfikowane podstawowe reguły formatowania.

### Metryki produktowe

* **Użycie:** w każdym miesiącu powinno zostać zapisanych co najmniej
  pięć planów (`plan_saved`). Liczenie odbywa się na podstawie
  zdarzeń `plan_saved` w bazie danych (miesiąc UTC).
* **Sprawiedliwość:** wskaźnik nierówności (różnica między maksymalną a
  minimalną liczbą dyżurów dla aktywnych członków) powinien
  oscylować w przedziale 0–10; przekroczenie wartości 10 sygnalizuje
  konieczność przeanalizowania składu zespołu lub zakresu planu. Definicja
  nierówności opiera się na literaturze dotyczącej fairness, gdzie
  niesprawiedliwość systemu mierzy się maksymalną różnicą między
  pożądanym a rzeczywistym obciążeniem.
* **Akceptacja użytkowników:** Tech Lead korzysta regularnie z narzędzia,
  ponieważ pozwala mu oszczędzić czas i zminimalizować konflikty w zespole;
  mierzone poprzez liczbę generacji (`plan_generated`) i pozytywną
  informację zwrotną (np. ankiety wewnętrzne).
* **Minimalna liczba dni `UNASSIGNED`:** dążymy do ograniczenia liczby
  dni bez przypisanego dyżuranta; utrzymanie tego wskaźnika poniżej 5% w
  stosunku do wszystkich zaplanowanych dni sygnalizuje poprawne
  zarządzanie dostępnością.

Metryki te będą regularnie monitorowane w celu oceny, czy produkt
spełnia oczekiwania użytkowników i czy zapewnia sprawiedliwy podział
dyżurów w zespole.