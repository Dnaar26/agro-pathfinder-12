import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function ConnectionBadge() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  return (
    <Badge variant={online ? "default" : "destructive"} className="gap-1.5 text-xs px-2 py-0.5">
      <span className={`size-1.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
      {online ? "En línea" : "Fuera de línea"}
    </Badge>
  );
}
