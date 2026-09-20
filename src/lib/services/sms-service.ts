import { supabase } from "@/integrations/supabase/client";

type SmsPayload = {
  to: string;
  body: string;
};

export async function sendSmsAlert(phone: string, message: string) {
  try {
    // Twilio integration via Supabase Edge Function
    const { error } = await supabase.functions.invoke("send-sms", {
      body: { to: phone, body: message } satisfies SmsPayload,
    });
    if (error) throw error;
  } catch (e) {
    console.warn("SMS send failed (function may not be deployed):", e);
  }
}

export async function sendFrostAlert(phone: string, date: string) {
  await sendSmsAlert(phone, `❄️ ALERTA DE HELADA SIGIC: Se pronostican temperaturas bajo 2°C para el ${date}. Protege tus cultivos.`);
}

export async function sendRainAlert(phone: string, date: string) {
  await sendSmsAlert(phone, `🌧️ ALERTA DE LLUVIA INTENSA SIGIC: Se pronostican lluvias fuertes para el ${date}. Revisa drenajes.`);
}

export async function sendStockAlert(phone: string, itemName: string) {
  await sendSmsAlert(phone, `⚠️ ALERTA DE STOCK SIGIC: El insumo "${itemName}" está por debajo del mínimo. Repón lo antes posible.`);
}

export async function sendAlertToUser(userId: string, title: string, body: string) {
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", userId).maybeSingle();
  if (profile?.phone) {
    await sendSmsAlert(profile.phone, `${title}: ${body}`);
  }
}
