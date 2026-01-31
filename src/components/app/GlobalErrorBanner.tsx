import { SectionMessage } from "@/components/app/SectionMessage";
import { Button } from "@/components/ui/button";
import { useAppNotifications } from "@/components/app/NotificationsProvider";

export const GlobalErrorBanner = () => {
  const { bannerError, clearBannerError } = useAppNotifications();

  if (!bannerError) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pt-4">
      <SectionMessage
        variant="error"
        title="Something went wrong"
        message={bannerError.message}
        action={
          <Button size="sm" variant="outline" onClick={clearBannerError}>
            Dismiss
          </Button>
        }
      />
    </div>
  );
};
