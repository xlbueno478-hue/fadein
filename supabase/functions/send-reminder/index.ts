import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { type } = await req.json();
    if (!["24h", "2h"].includes(type)) {
      return new Response(JSON.stringify({ error: "type inválido" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const hoursAhead = type === "24h" ? 24 : 2;
    const target = Date.now() + hoursAhead * 3600_000;
    const win = 8 * 60_000;

    const { data: appts, error } = await supabase.rpc("get_appointments_needing_reminder", {
      p_type: type,
      p_window_start: new Date(target - win).toISOString(),
      p_window_end: new Date(target + win).toISOString(),
    });
    if (error) throw error;

    const r = { sent: 0, failed: 0, skipped: 0, total: appts?.length || 0 };

    for (const apt of appts || []) {
      const cfg = apt.whatsapp_config;
      if (!cfg?.is_active || !cfg?.access_token) { r.skipped++; continue; }

      const scheduled = new Date(apt.scheduled_at);
      const dateStr = scheduled.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
      });
      const timeStr = scheduled.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
      });
      const phone = apt.client_phone.replace(/\D/g, "");
      const firstName = (apt.client_name || "").split(" ")[0] || "Cliente";
      const tplName = type === "24h" ? cfg.template_24h_name : cfg.template_2h_name;

      const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: tplName,
          language: { code: "pt_BR" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: firstName },
              { type: "text", text: apt.barber_name || "seu barbeiro" },
              { type: "text", text: dateStr },
              { type: "text", text: timeStr },
            ],
          }],
        },
      };

      try {
        const res = await fetch(`${META_API}/${cfg.phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cfg.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await res.json();

        if (res.ok && result.messages?.[0]?.id) {
          await supabase.from("reminder_log").insert({
            appointment_id: apt.id, type, status: "sent",
            whatsapp_message_id: result.messages[0].id,
          });
          r.sent++;
        } else {
          const msg = (result.error?.message || JSON.stringify(result)).substring(0, 500);
          await supabase.from("reminder_log").insert({
            appointment_id: apt.id, type, status: "failed", error_message: msg,
          });
          await supabase.from("whatsapp_config").update({
            last_error: msg, last_error_at: new Date().toISOString(),
          }).eq("shop_id", apt.shop_id);
          r.failed++;
        }
      } catch (err: any) {
        await supabase.from("reminder_log").insert({
          appointment_id: apt.id, type, status: "failed",
          error_message: (err.message || "").substring(0, 500),
        });
        r.failed++;
      }
    }

    return new Response(JSON.stringify({ type, ...r, ts: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-reminder:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});