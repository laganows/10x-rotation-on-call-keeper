<authentication_analysis>
## Analiza przepływów autentykacji (OAuth, MVP)

### 1) Przepływy autentykacji z PRD i auth-spec

- **Logowanie OAuth (US-001)**:
  - Wejście na `/login`
  - Kliknięcie przycisku OAuth (GitHub)
  - Powrót z providera z aktywną sesją Supabase
  - Przejście do aplikacji (`/`), a przy braku profilu/zespołu do `/setup`

- **Wylogowanie (US-001)**:
  - Kliknięcie `Logout`
  - `supabase.auth.signOut()`
  - Przekierowanie do `/login`

- **Ochrona tras**:
  - Gdy `PUBLIC_AUTH_REQUIRED=true` i brak sesji
    - redirect do `/login` (docelowo SSR + guard klientowy)
  - Gdy `PUBLIC_AUTH_REQUIRED=false` (tryb dev)
    - dostęp bez logowania jest możliwy, login nadal dostępny

### 2) Aktorzy i interakcje

- **Przeglądarka**: nawigacja, UI React, przechowywanie sesji Supabase.
- **Middleware**: (docelowo) odczyt sesji z cookies i decyzja o redirect.
- **Astro API**: endpointy domenowe wymagające tokenu (Authorization Bearer).
- **Supabase Auth**: OAuth sign-in/out, sesja i odświeżanie tokenów.

### 3) Tokeny i odświeżanie

- `AuthProvider` pobiera sesję (`getSession`) i nasłuchuje zmian.
- `useApiClient` dołącza `Authorization: Bearer <accessToken>`.
- Przy wygaśnięciu tokenu:
  - Supabase odświeża token, a `onAuthStateChange` aktualizuje stan
  - Albo API zwraca 401 i UI wymusza ponowne logowanie

### 4) Opis kroków autentykacji (skrót)

- Wejście na trasę chronioną → weryfikacja sesji (SSR docelowo + guard).
- Brak sesji → redirect do `/login`.
- Kliknięcie OAuth → Supabase Auth uruchamia przepływ OAuth.
- Sukces → Supabase zapisuje sesję; React odczytuje sesję i przechodzi do app.
- Bootstrap profilu/zespołu → ewentualny redirect do `/setup`.
- Logout → czyszczenie sesji i redirect do `/login`.
</authentication_analysis>

<mermaid_diagram>

```mermaid
sequenceDiagram
  autonumber
  participant Browser as Przegladarka
  participant MW as Middleware
  participant API as Astro API
  participant Auth as Supabase Auth

  Note over Browser,MW: Tryb dev: auth nie jest wymagany<br/>mozna wejsc bez loginu

  Browser->>MW: Zadanie strony chronionej
  activate MW
  alt Auth wymagany i brak sesji
    MW-->>Browser: Redirect do logowania
  else Auth nie wymagany lub sesja istnieje
    MW-->>Browser: Render strony
  end
  deactivate MW

  Browser->>Browser: UI logowania OAuth
  activate Browser
  Browser->>Auth: Start OAuth
  activate Auth
  Auth-->>Browser: Redirect do providera
  Browser->>Auth: Powrot po OAuth
  Auth-->>Browser: Sesja aktywna
  deactivate Auth
  deactivate Browser

  Browser->>API: Zadania danych z tokenem
  activate API
  API->>Auth: Weryfikacja tokenu
  alt Token poprawny
    API-->>Browser: Dane aplikacji
  else Token wygasl lub bledny
    API-->>Browser: 401 i wymuszenie logowania
  end
  deactivate API

  Browser->>Auth: Logout
  activate Auth
  Auth-->>Browser: Sesja usunieta
  deactivate Auth
  Browser-->>Browser: Redirect do logowania
```

</mermaid_diagram>

