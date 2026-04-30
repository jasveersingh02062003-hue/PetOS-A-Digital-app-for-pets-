import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useHealthAlerts } from "@/hooks/useHealthAlerts";
import { useEffect, useRef, useState } from "react";

export const NotificationBell = () => {
  const { unreadCount } = useNotifications();
  const { unread: alertUnread } = useHealthAlerts();
  const total = (unreadCount ?? 0) + alertUnread.length;
  const prevTotal = useRef(total);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (total > prevTotal.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1600);
      return () => clearTimeout(t);
    }
    prevTotal.current = total;
  }, [total]);

  return (
    <Button asChild variant="ghost" size="icon" className="rounded-full relative">
      <Link to="/notifications" aria-label="Notifications">
        <Bell
          className={`h-5 w-5 ${pulse ? "animate-bounce text-primary" : ""}`}
          strokeWidth={1.5}
        />
        {total > 0 && (
          <span
            className={`absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-medium ${
              pulse ? "animate-pulse" : ""
            }`}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </Link>
    </Button>
  );
};
