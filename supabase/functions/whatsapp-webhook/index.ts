import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "fadein-verify";
const CONFIRM = ["SIM", "S", "OK", "CONFIRMAR", "CONFIRMO", "CONFIRMADO", "BELEZA"];
const CANCEL  = ["CANCELAR", "NAO", "NÃO", "N", "DESMARCAR"];

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const changes = body.entry?.[0]?.changes?.[0]?.value;

    // Mensagem do cliente
    const msg = changes?.messages?.[0];
    if (msg?.type === "text") {
      const fromPhone = msg.from;
      const text = (msg.text.body || "").trim().toUpperCase();

      let newStatus: "confirmed" | "cancelled" | null = null;
      if (CONFIRM.some(w => text === w || text.startsWith(w + " "))) newStatus = "confirmed";
      else if (CANCEL.some(w => text === w || text.startsWith(w + " "))) newStatus = "cancelled";

      if (newStatus) {
        const { data: logs } = await supabase
          .from("reminder_log")
          .select("id, appointment_id, appointments!inner(id, client_phone, date)")
          .eq("status", "sent")
          .is("response_at", null)
          .gte("appointments.date", new Date().toISOString())
          .order("sent_at", { ascending: false })
          .limit(10);

        const suffix = fromPhone.slice(-10);
        const match = (logs || []).find((l: any) =>
          l.appointments?.client_phone?.replace(/\D/g, "").endsWith(suffix)
        );

        if (match) {
          await supabase.from("appointments").update({
            confirmation_status: newStatus,
            ...(newStatus === "cancelled"
              ? { cancelled_at: new Date().toISOString(), cancelled_by: "client" }
              : {}),
          }).eq("id", match.appointment_id);

          await supabase.from("reminder_log").update({
            status: newStatus,
            response_at: new Date().toISOString(),
            response_text: (msg.text.body || "").substring(0, 200),
          }).eq("id", match.id);
        }
      }
    }

    // Status (delivered/read/failed)
    const st = changes?.statuses?.[0];
    if (st?.id) {
      const newSt =
        st.status === "delivered" ? "delivered" :
        st.status === "read" ? "read" :
        st.status === "failed" ? "failed" : null;
      if (newSt) {
        await supabase.from("reminder_log").update({
          status: newSt,
          ...(st.status === "failed"
            ? { error_message: JSON.stringify(st.errors).substring(0, 500) }
            : {}),
        }).eq("whatsapp_message_id", st.id);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("webhook:", err);
    return new Response("OK", { status: 200 });
  }
});