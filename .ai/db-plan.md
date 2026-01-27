# ROCK — PostgreSQL (Supabase) Database Schema Plan (MVP)

## Supabase Auth — ważne (tabela `users`)

- **Tabela użytkowników jest dostarczana przez Supabase Auth jako `auth.users`**.
- **Nie tworzymy tabeli `public.users` w migracjach** — utworzenie własnej tabeli `public.users` nie zastępuje Supabase Auth i zwykle prowadzi do duplikacji/utraty funkcji (sesje, OAuth, zarządzanie tożsamościami, itp.).
- W tym schemacie wszystkie referencje do użytkownika wskazują na **`auth.users(id)`**, a dane UI trzymamy w `public.profiles`.

## 1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

### `public.profiles` (1:1 z `auth.users`)
- **Cel**: minimalny profil użytkownika dla UI + relacje (np. `plans.created_by`).
- **Kolumny**
  - `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `display_name text`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- **Uwagi**
  - `updated_at` aktualizowane triggerem (patrz sekcja „Uwagi”).

### `public.teams` (tenant; w MVP 1 user = 1 team, ale model jawny)
- **Kolumny**
  - `team_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `name text NOT NULL DEFAULT 'My team'`
  - `max_saved_count integer NOT NULL DEFAULT 0 CHECK (max_saved_count >= 0)`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- **Ograniczenia**
  - `UNIQUE (owner_id)` (MVP: jeden team na właściciela; łatwe do zdjęcia w przyszłości)

### `public.members` (członkowie zespołu; soft-delete)
- **Kolumny**
  - `member_id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (immutable; używany w tie-breakerze)
  - `team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE`
  - `display_name text NOT NULL`
  - `initial_on_call_count integer NOT NULL CHECK (initial_on_call_count >= 0)` (snapshot przy dodaniu)
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
  - `deleted_at timestamptz` (soft-delete; aktywni to `deleted_at IS NULL`)
- **Ograniczenia**
  - `UNIQUE (team_id, member_id)` (dla kluczy złożonych w tabelach potomnych; technicznie redundantne wobec PK, ale użyteczne)

### `public.unavailabilities` (niedostępności; pojedynczy dzień)
- **Kolumny**
  - `unavailability_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE`
  - `member_id uuid NOT NULL`
  - `day date NOT NULL`
  - `created_at timestamptz NOT NULL DEFAULT now()`
- **Ograniczenia**
  - `UNIQUE (team_id, member_id, day)` (wymusza brak duplikatów)
  - `FOREIGN KEY (team_id, member_id) REFERENCES public.members(team_id, member_id) ON DELETE RESTRICT`

### `public.plans` (nagłówek planu; nieedytowalny po zapisie)
- **Kolumny**
  - `plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE`
  - `created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `start_date date NOT NULL`
  - `end_date date NOT NULL`
  - `date_range daterange GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED`
- **Ograniczenia**
  - `UNIQUE (team_id, plan_id)` (umożliwia bezpieczne FK złożone z `team_id`)
  - `CHECK (start_date <= end_date)`
  - `CHECK ((end_date - start_date + 1) BETWEEN 1 AND 365)` (limit MVP; „nie w przeszłości” egzekwuje API)
  - **Brak nakładania planów w tym samym teamie** (constraint typu `EXCLUDE`, patrz sekcja „Indeksy”)

### `public.plan_assignments` (wiersz per dzień; `UNASSIGNED` = `member_id NULL`)
- **Kolumny**
  - `team_id uuid NOT NULL`
  - `plan_id uuid NOT NULL`
  - `day date NOT NULL`
  - `member_id uuid` (NULL oznacza `UNASSIGNED`)
  - `created_at timestamptz NOT NULL DEFAULT now()`
- **Klucz główny**
  - `PRIMARY KEY (plan_id, day)` (unikalność przypisania per dzień w planie)
- **Ograniczenia**
  - `FOREIGN KEY (team_id, plan_id) REFERENCES public.plans(team_id, plan_id) ON DELETE CASCADE`
  - `FOREIGN KEY (team_id, member_id) REFERENCES public.members(team_id, member_id) ON DELETE RESTRICT`
  - (jawnie dopuszcza `member_id NULL`; FK jest pomijany gdy którakolwiek kolumna FK jest NULL)

### `public.events` (instrumentacja: `plan_generated` / `plan_saved`)
- **Kolumny**
  - `event_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE`
  - `actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
  - `event_type text NOT NULL CHECK (event_type IN ('plan_generated', 'plan_saved'))`
  - `occurred_at timestamptz NOT NULL DEFAULT now()`
  - `start_date date`
  - `end_date date`
  - `range_days integer CHECK (range_days IS NULL OR range_days BETWEEN 1 AND 365)`
  - `members_count integer CHECK (members_count IS NULL OR members_count >= 0)`
  - `unassigned_count integer CHECK (unassigned_count IS NULL OR unassigned_count >= 0)`
  - `inequality integer CHECK (inequality IS NULL OR inequality >= 0)` (wypełniane dla `plan_saved`)
  - `duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0)`
  - `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`

## 2. Relacje między tabelami

- **`auth.users` 1 — 1 `public.profiles`**
  - `profiles.user_id` jest jednocześnie PK i FK do `auth.users(id)`.

- **`auth.users` 1 — 1 `public.teams` (MVP)**
  - `teams.owner_id` wskazuje właściciela; `UNIQUE(owner_id)` wymusza 1:1.

- **`public.teams` 1 — N `public.members`**
  - `members.team_id -> teams.team_id`.

- **`public.members` 1 — N `public.unavailabilities`**
  - `unavailabilities (team_id, member_id) -> members(team_id, member_id)`.

- **`public.teams` 1 — N `public.plans`**
  - `plans.team_id -> teams.team_id`.

- **`public.plans` 1 — N `public.plan_assignments`**
  - `plan_assignments (team_id, plan_id) -> plans(team_id, plan_id)`.

- **`public.members` 1 — N `public.plan_assignments` (opcjonalnie)**
  - `plan_assignments.member_id` może być NULL (UNASSIGNED) lub wskazywać członka w tym samym teamie.

- **`public.teams` 1 — N `public.events`**
  - `events.team_id -> teams.team_id`.

## 3. Indeksy

### Wymagane rozszerzenia (dla constraintów/UUID)
- **`pgcrypto`**: dla `gen_random_uuid()` (w Supabase zazwyczaj dostępne).
- **`btree_gist`**: dla `EXCLUDE` z porównaniem `team_id` po `=`.

### `public.teams`
- `UNIQUE (owner_id)`
- (opcjonalnie) `INDEX (owner_id)` – zwykle zbędne przez UNIQUE, ale OK dla czytelności planu.

### `public.members`
- `INDEX members_team_id_idx ON members(team_id)`
- **Częściowy indeks aktywnych**: `INDEX members_active_idx ON members(team_id, member_id) WHERE deleted_at IS NULL`
- (opcjonalnie) `INDEX members_active_for_ui_idx ON members(team_id, display_name) WHERE deleted_at IS NULL`

### `public.unavailabilities`
- `UNIQUE (team_id, member_id, day)` (wymusza też indeks)
- `INDEX unavailabilities_team_day_idx ON unavailabilities(team_id, day)`
- `INDEX unavailabilities_team_member_day_idx ON unavailabilities(team_id, member_id, day)`

### `public.plans`
- `INDEX plans_team_created_at_idx ON plans(team_id, created_at DESC)`
- `INDEX plans_team_start_end_idx ON plans(team_id, start_date, end_date)`
- **EXCLUDE (blokada overlap)**:
  - `ALTER TABLE public.plans ADD CONSTRAINT plans_no_overlap EXCLUDE USING gist (team_id WITH =, date_range WITH &&);`
  - To eliminuje race-condition przy równoległych zapisach planów.

### `public.plan_assignments`
- PK `PRIMARY KEY (plan_id, day)` (indeks implicit)
- `INDEX plan_assignments_team_day_idx ON plan_assignments(team_id, day)`
- `INDEX plan_assignments_team_member_day_idx ON plan_assignments(team_id, member_id, day)`
- `INDEX plan_assignments_plan_id_idx ON plan_assignments(plan_id)` (opcjonalnie; często pokryte przez PK, ale bywa przydatne)

### `public.events`
- `INDEX events_team_occurred_at_idx ON events(team_id, occurred_at DESC)`
- `INDEX events_team_type_occurred_at_idx ON events(team_id, event_type, occurred_at DESC)`

## 4. Zasady PostgreSQL (RLS) (Supabase)

### Założenia
- RLS włączone na wszystkich tabelach domenowych: `teams`, `members`, `unavailabilities`, `plans`, `plan_assignments`, `events`, `profiles`.
- Tenant bazuje na `team_id`, a dostęp na `teams.owner_id = auth.uid()` (przygotowane do przyszłego `team_members` bez zmiany kluczy).

### Wzorzec predykatu dostępu do teamu
- Predykat używany w politykach:
  - `EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = <table>.team_id AND t.owner_id = auth.uid())`

### Przykładowe polityki (SQL do migracji)

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unavailabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- TEAMS (MVP: owner)
CREATE POLICY teams_select_own ON public.teams
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY teams_insert_own ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY teams_update_own ON public.teams
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Helper predicate (inline in policies below)
-- EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = <table>.team_id AND t.owner_id = auth.uid())

-- MEMBERS
CREATE POLICY members_select_team_owner ON public.members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = members.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY members_insert_team_owner ON public.members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = members.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY members_update_team_owner ON public.members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = members.team_id AND t.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = members.team_id AND t.owner_id = auth.uid())
  );
-- No DELETE policy in MVP (soft-delete instead)

-- UNAVAILABILITIES (INSERT/DELETE, optional UPDATE omitted)
CREATE POLICY unavailabilities_select_team_owner ON public.unavailabilities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = unavailabilities.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY unavailabilities_insert_team_owner ON public.unavailabilities
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = unavailabilities.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY unavailabilities_delete_team_owner ON public.unavailabilities
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = unavailabilities.team_id AND t.owner_id = auth.uid())
  );

-- PLANS (immutable: SELECT + INSERT only)
CREATE POLICY plans_select_team_owner ON public.plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = plans.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY plans_insert_team_owner ON public.plans
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = plans.team_id AND t.owner_id = auth.uid())
    AND created_by = auth.uid()
  );
-- No UPDATE/DELETE policies

-- PLAN_ASSIGNMENTS (immutable: SELECT + INSERT only)
CREATE POLICY plan_assignments_select_team_owner ON public.plan_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = plan_assignments.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY plan_assignments_insert_team_owner ON public.plan_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = plan_assignments.team_id AND t.owner_id = auth.uid())
  );
-- No UPDATE/DELETE policies

-- EVENTS (immutable: SELECT + INSERT only)
CREATE POLICY events_select_team_owner ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = events.team_id AND t.owner_id = auth.uid())
  );
CREATE POLICY events_insert_team_owner ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.team_id = events.team_id AND t.owner_id = auth.uid())
    AND actor_user_id = auth.uid()
  );
-- No UPDATE/DELETE policies
```

### `public.profiles`
- **SELECT/INSERT/UPDATE**: jak w sekcji SQL powyżej (tylko własny wiersz).

### `public.teams`
- **SELECT/INSERT/UPDATE**: jak w sekcji SQL powyżej (tylko owner).

### `public.members`
- **SELECT/INSERT/UPDATE**: jak w sekcji SQL powyżej (owner teamu).
- **DELETE**: brak w MVP (soft-delete przez `deleted_at`).

### `public.unavailabilities`
- **SELECT/INSERT/DELETE**: jak w sekcji SQL powyżej (owner teamu).
- **UPDATE**: zwykle brak (kasowanie + insert).

### `public.plans` (nieedytowalne)
- **SELECT/INSERT**: jak w sekcji SQL powyżej (owner teamu; `created_by = auth.uid()`).
- **UPDATE/DELETE**: brak w MVP.

### `public.plan_assignments` (nieedytowalne)
- **SELECT/INSERT**: jak w sekcji SQL powyżej (owner teamu).
- **UPDATE/DELETE**: brak w MVP.

### `public.events`
- **SELECT/INSERT**: jak w sekcji SQL powyżej (owner teamu; `actor_user_id = auth.uid()`).
- **UPDATE/DELETE**: brak w MVP.

## 5. Dodatkowe uwagi / wyjaśnienia decyzji projektowych

- **Deterministyczny tie-breaker**: generator sortuje rosnąco po `member_id` (UUID ordering w Postgres) przy remisie `effectiveCount`.
- **Źródło prawdy dla `savedCount`**: brak liczników w `members`; `savedCount` liczone jako `COUNT(*)` z `plan_assignments` z `member_id = members.member_id` (tylko zapisane plany).
- **Aktywni vs historyczni**: planowanie i „fairness bieżące” operuje na `members.deleted_at IS NULL`, natomiast historia/audit może uwzględniać wszystkich.
- **UNASSIGNED**: reprezentowane przez `plan_assignments.member_id IS NULL` (bez pseudo-członka).
- **Spójność tenantów (`team_id`)**: klucze złożone (`(team_id, member_id)` oraz `(team_id, plan_id)`) uniemożliwiają „przepięcie” rekordów między teamami w tabelach potomnych.
- **Nieedytowalność planów**: egzekwowana przez RLS (brak UPDATE/DELETE) zamiast flag wiersza.
- **Aktualizacja `max_saved_count`**: przechowywana w `teams.max_saved_count` dla O(1) ustawiania `initial_on_call_count` przy dodaniu nowego członka; aktualizowana transakcyjnie przy zapisie planu (po insertach do `plan_assignments`).
- **`updated_at`**: zalecany prosty trigger per tabela (np. `teams`, `members`, `profiles`) ustawiający `updated_at = now()` na UPDATE.
- **Walidacje trudne do wyrażenia CHECK**:
  - `plan_assignments.day` w zakresie `plans.start_date..end_date` — rekomendowany trigger lub zapis wyłącznie przez kontrolowany endpoint/RPC; w MVP zwykle wystarczy kontrola aplikacyjna.
- **Duplikaty niedostępności**: baza wymusza unikalność; API może obsłużyć konflikt jako 409 albo idempotentne “OK” (poprzez `INSERT ... ON CONFLICT DO NOTHING`).

