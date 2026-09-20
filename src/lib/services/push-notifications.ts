import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BLwVZ7GkRqQ0KpYX-jK8XnJpQm3Vd3QqQ0KpYX-jK8X";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) return sub;

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return sub;

  await supabase.from("push_subscriptions").upsert({
    user_id: u.user.id,
    subscription: sub.toJSON(),
  });

  return sub;
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();

  const { data: u } = await supabase.auth.getUser();
  if (u.user) {
    await supabase.from("push_subscriptions").delete().eq("user_id", u.user.id);
  }
}

export function showLocalNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png" });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw.split("").map((c) => c.charCodeAt(0)));
}
