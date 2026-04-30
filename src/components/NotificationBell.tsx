import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useHealthAlerts } from "@/hooks/useHealthAlerts";

export const NotificationBell = () => {
  const { unreadCount } = useNotifications();
  const { unread: alertUnread } = useHealthAlerts();
  const total = (unreadCount ?? 0) + alertUnread.length;
  return (
    <Button asChild variant="ghost" size="icon" className="rounded-full relative">
      <Link to="/notifications" aria-label="Notifications">
        <Bell className="h-5 w-5" strokeWidth={1.5} />
        {total > 0 && (
          <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-medium">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </Link>
    </Button>
  );
};
