<user_journey_analysis>
## Analiza podróży użytkownika (logowanie i dostęp, MVP)

### 1) Ścieżki użytkownika z PRD i auth-spec

- Wejście do aplikacji jako niezalogowany:
  - Jeśli auth wymagany → przekierowanie do logowania
  - Jeśli auth opcjonalny (dev) → dostęp do aplikacji bez logowania
- Logowanie przez OAuth:
  - Ekran logowania → start OAuth → powrót → aplikacja
- Pierwsze uruchomienie po logowaniu:
  - Jeśli brak profilu/zespołu → przejście do setup
  - Po setup → przejście do generatora
- Korzystanie z aplikacji:
  - Generator / Members / Unavailabilities / Plans / Stats
- Wylogowanie:
  - Logout → powrót do logowania

### 2) Główne podróże i stany

- Niezalogowany → Logowanie → Zalogowany → (Setup) → Aplikacja
- Zalogowany → Wylogowanie → Niezalogowany
- Dev-mode: Niezalogowany → Aplikacja (bez logowania)

### 3) Punkty decyzyjne i alternatywne ścieżki

- Czy auth jest wymagany?
- Czy sesja jest aktywna?
- Czy profil/zespoł są skonfigurowane?
- Czy token jest ważny?

### 4) Cel stanów (skrót)

- Niezalogowany: brak dostępu do funkcji w trybie produkcyjnym.
- Logowanie: uruchomienie OAuth i obsługa ewentualnych błędów.
- Setup: utworzenie/uzupełnienie profilu i zespołu.
- Aplikacja: praca z głównymi modułami (generator, CRUD, plany, statystyki).
- Wylogowanie: zakończenie sesji i powrót do logowania.
</user_journey_analysis>

<mermaid_diagram>

```mermaid
stateDiagram-v2
  [*] --> Wejscie

  state "Wejscie do aplikacji" as Wejscie
  state "Niezalogowany" as Niezalogowany
  state "Logowanie" as Logowanie
  state "Proces OAuth" as OAuth
  state "Zalogowany" as Zalogowany
  state "Setup" as Setup
  state "Aplikacja" as Aplikacja
  state "Wylogowanie" as Wylogowanie

  state if_auth_required <<choice>>
  state if_sesja <<choice>>
  state if_setup <<choice>>

  Wejscie --> if_auth_required

  if_auth_required --> Niezalogowany: Auth wymagany
  if_auth_required --> Aplikacja: Auth opcjonalny (dev)

  Niezalogowany --> if_sesja
  if_sesja --> Logowanie: Brak sesji
  if_sesja --> Zalogowany: Sesja aktywna

  Logowanie --> OAuth: Start OAuth
  OAuth --> Zalogowany: Sukces
  OAuth --> Logowanie: Blad logowania

  Zalogowany --> if_setup
  if_setup --> Setup: Brak profilu lub zespołu
  if_setup --> Aplikacja: Setup gotowy

  Setup --> Aplikacja: Zapis profilu i zespołu

  state "Moduly aplikacji" as Moduly {
    state "Generator" as Generator
    state "Czlonkowie" as Czlonkowie
    state "Niedostepnosci" as Niedostepnosci
    state "Plany" as Plany
    state "Statystyki" as Statystyki

    Generator --> Czlonkowie
    Czlonkowie --> Niedostepnosci
    Niedostepnosci --> Plany
    Plany --> Statystyki
    Statystyki --> Generator
  }

  Aplikacja --> Moduly
  Moduly --> Wylogowanie: Logout
  Wylogowanie --> Logowanie

  Logowanie --> [*]: Zamkniecie aplikacji
```

</mermaid_diagram>

