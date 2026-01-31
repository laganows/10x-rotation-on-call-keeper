import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { AppShellLayout } from "@/components/app/AppShellLayout";
import type { RouteId, RouteParams } from "@/lib/view-models/ui";
import { useBootstrap, BootstrapProvider } from "@/lib/bootstrap/BootstrapProvider";
import { GeneratorView } from "@/components/views/GeneratorView";
import { LoginView } from "@/components/views/LoginView";
import { MembersView } from "@/components/views/MembersView";
import { PlanDetailView } from "@/components/views/PlanDetailView";
import { PlansListView } from "@/components/views/PlansListView";
import { SetupView } from "@/components/views/SetupView";
import { StatsView } from "@/components/views/StatsView";
import { UnavailabilitiesView } from "@/components/views/UnavailabilitiesView";
import { ViewPlaceholder } from "@/components/views/ViewPlaceholder";
import { Button } from "@/components/ui/button";

export interface ReactRootProps {
  routeId: RouteId;
  routeParams?: RouteParams;
  initialUrl?: string;
}

const renderRoute = (routeId: RouteId, routeParams?: RouteParams) => {
  switch (routeId) {
    case "login":
      return <LoginView />;
    case "setup":
      return <SetupView />;
    case "generator":
      return <GeneratorView />;
    case "members":
      return <MembersView />;
    case "unavailabilities":
      return <UnavailabilitiesView />;
    case "plans":
      return <PlansListView />;
    case "planDetail": {
      if (!routeParams?.planId) {
        return (
          <ViewPlaceholder
            title="Plan details"
            description="Missing plan identifier in route parameters."
          />
        );
      }
      return <PlanDetailView planId={routeParams.planId} />;
    }
    case "stats":
      return <StatsView />;
    default:
      return (
        <ViewPlaceholder
          title="Unknown route"
          description={`Unknown route id: ${routeId}`}
        />
      );
  }
};

const routeToPath = (routeId: RouteId) => {
  switch (routeId) {
    case "generator":
      return "/";
    case "members":
      return "/members";
    case "unavailabilities":
      return "/unavailabilities";
    case "plans":
    case "planDetail":
      return "/plans";
    case "stats":
      return "/stats";
    case "setup":
      return "/setup";
    case "login":
    default:
      return "/login";
  }
};

const ProtectedApp = ({ routeId, routeParams }: { routeId: RouteId; routeParams?: RouteParams }) => {
  const { state: authState, logout } = useAuth();
  const { state: bootstrapState, refetch } = useBootstrap();
  const activePath = routeToPath(routeId);
  const userLabel = bootstrapState.profile?.displayName ?? authState.session?.userEmail ?? "Anonymous";
  const isSetupRoute = routeId === "setup";

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (bootstrapState.status === "needsSetup" && !isSetupRoute) {
      window.location.assign("/setup");
    }

    if (bootstrapState.status === "ready" && isSetupRoute) {
      window.location.assign("/");
    }
  }, [bootstrapState.status, isSetupRoute]);

  if (bootstrapState.status === "idle" || bootstrapState.status === "loading") {
    return (
      <ViewPlaceholder title="Loading" description="Loading profile and team data." />
    );
  }

  if (bootstrapState.status === "error") {
    return (
      <ViewPlaceholder title="Unable to load app data" description={bootstrapState.error?.message}>
        <Button onClick={refetch} variant="outline">
          Retry
        </Button>
      </ViewPlaceholder>
    );
  }

  if (bootstrapState.status === "needsSetup") {
    if (!isSetupRoute) {
      return (
        <ViewPlaceholder title="Setup required" description="Redirecting to setup..." />
      );
    }
    return renderRoute(routeId, routeParams);
  }

  if (isSetupRoute) {
    return (
      <ViewPlaceholder title="Setup complete" description="Redirecting to generator..." />
    );
  }

  return (
    <AppShellLayout activePath={activePath} userLabel={userLabel} onLogout={logout}>
      {renderRoute(routeId, routeParams)}
    </AppShellLayout>
  );
};

const ReactRoot = ({ routeId, routeParams, initialUrl }: ReactRootProps) => {
  if (routeId === "login") {
    return (
      <AuthProvider>
        <div id="app" data-route={routeId} data-initial-url={initialUrl}>
          {renderRoute(routeId, routeParams)}
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BootstrapProvider>
        <div id="app" data-route={routeId} data-initial-url={initialUrl}>
          <ProtectedApp routeId={routeId} routeParams={routeParams} />
        </div>
      </BootstrapProvider>
    </AuthProvider>
  );
};

export default ReactRoot;
