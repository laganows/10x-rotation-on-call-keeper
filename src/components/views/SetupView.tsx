import { type FormEvent, useMemo, useState } from "react";

import type { ApiDataResponse, ProfileDto, TeamDto } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBootstrap } from "@/lib/bootstrap/BootstrapProvider";
import { useApiClient } from "@/lib/http/api-client";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

interface FieldErrors {
  displayName?: string;
  teamName?: string;
}

const getFieldError = (error: ApiErrorViewModel | null, field: string) => {
  if (!error?.details || typeof error.details !== "object") return null;
  const details = error.details as { fieldErrors?: Record<string, string[]> };
  const fieldErrors = details.fieldErrors?.[field];
  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return null;
  return fieldErrors[0];
};

export const SetupView = () => {
  const { request } = useApiClient();
  const { refetch } = useBootstrap();
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [formError, setFormError] = useState<ApiErrorViewModel | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isSubmitting = status === "submitting";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmedTeamName = teamName.trim();
    if (!trimmedTeamName) {
      setFieldErrors({ teamName: "Team name is required." });
      return;
    }

    const normalizedDisplayName = displayName.trim();
    const payloadDisplayName = normalizedDisplayName.length > 0 ? normalizedDisplayName : null;

    setStatus("submitting");

    const profileResult = await request<ApiDataResponse<ProfileDto>>("/api/profile", {
      method: "POST",
      body: { displayName: payloadDisplayName },
    });

    if (profileResult.error) {
      setFormError(profileResult.error);
      setFieldErrors((prev) => ({
        ...prev,
        displayName: getFieldError(profileResult.error, "displayName") ?? prev.displayName,
      }));
      setStatus("idle");
      return;
    }

    const teamResult = await request<ApiDataResponse<TeamDto>>("/api/team", {
      method: "POST",
      body: { name: trimmedTeamName },
    });

    if (teamResult.error) {
      setFormError(teamResult.error);
      setFieldErrors((prev) => ({
        ...prev,
        teamName: getFieldError(teamResult.error, "name") ?? prev.teamName,
      }));
      setStatus("idle");
      return;
    }

    await refetch();
    setStatus("idle");
  };

  const helperText = useMemo(() => {
    if (formError) return formError.message;
    return "Complete profile and team details to continue.";
  }, [formError]);

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-card p-8 text-card-foreground shadow-sm"
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Setup</h1>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </header>

        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.displayName)}
            />
            {fieldErrors.displayName ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.displayName}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="teamName">Team name</Label>
            <Input
              id="teamName"
              name="teamName"
              type="text"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              autoComplete="organization"
              aria-invalid={Boolean(fieldErrors.teamName)}
            />
            {fieldErrors.teamName ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.teamName}
              </p>
            ) : null}
          </div>
        </section>

        {formError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {formError.message}
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          Zapisz i przejdz do Generatora
        </Button>
      </form>
    </main>
  );
};
