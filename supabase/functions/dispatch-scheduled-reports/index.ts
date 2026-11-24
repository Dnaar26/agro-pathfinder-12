// Supabase Edge Function: dispatch-scheduled-reports
// Despacha los reportes programados activos usando Resend Free Tier (3,000 correos/mes gratis).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Faltan variables de Supabase" }), { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: schedules, error } = await admin
    .from("scheduled_reports")
    .select("id, user_id, template, recipients, schedule")
    .eq("enabled", true)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!resendKey) {
    return new Response(
      JSON.stringify({ processed: 0, note: "Define RESEND_API_KEY (gratis en resend.com) para enviar correos." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let sentCount = 0;
  for (const item of schedules ?? []) {
    if (!Array.isArray(item.recipients) || item.recipients.length === 0) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "SIGIC Reportes <onboarding@resend.dev>",
        to: item.recipients,
        subject: `Reporte programado SIGIC (${item.template} - ${item.schedule})`,
        html: `<p>Tu reporte automático <strong>${item.template}</strong> (${item.schedule}) está listo en el panel de <strong>SIGIC</strong>.</p>`,
      }),
    });
    if (res.ok) {
      sentCount++;
      await admin
        .from("scheduled_reports")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", item.id);
    }
  }

  return new Response(JSON.stringify({ processed: sentCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
