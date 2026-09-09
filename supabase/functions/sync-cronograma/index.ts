import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Webhook payload received:", JSON.stringify(payload));

    const { type, table, record, old_record } = payload;

    // Verify if it's an update on the deliveries table
    if (type !== "UPDATE" || table !== "deliveries") {
      return new Response(
        JSON.stringify({ message: "Ignored: not an UPDATE event on deliveries table." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = record?.status;
    const oldStatus = old_record?.status;
    const orderNumber = record?.order_number;

    if (!orderNumber) {
      console.warn("Delivery updated, but order_number is empty.");
      return new Response(
        JSON.stringify({ message: "Ignored: order_number is empty." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newStatus === oldStatus) {
      return new Response(
        JSON.stringify({ message: "Ignored: status did not change." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map expedition delivery status to cronograma status
    // Cronograma status options: 'Pendente', 'Agendado', 'Em Rota', 'Entregue', 'Cancelado'
    // Expedition delivery status options: 'pendente', 'carregado', 'em_transito', 'chegou', 'instalou', 'assinou', 'entregue', 'finalizado', 'concluido', 'cancelado'
    let cronogramaStatus = null;

    if (["entregue", "finalizado", "concluido"].includes(newStatus)) {
      cronogramaStatus = "Entregue";
    } else if (newStatus === "cancelado") {
      cronogramaStatus = "Cancelado";
    } else if (["em_transito", "chegou", "instalou", "assinou", "carregado"].includes(newStatus)) {
      cronogramaStatus = "Em Rota";
    } else if (newStatus === "pendente") {
      cronogramaStatus = "Pendente";
    }

    if (!cronogramaStatus) {
      console.warn(`No cronograma status mapping found for new status: ${newStatus}`);
      return new Response(
        JSON.stringify({ message: `Ignored: no status mapping for ${newStatus}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target Cronograma Supabase credentials
    const cronogramaUrl = Deno.env.get("CRONOGRAMA_SUPABASE_URL");
    const cronogramaServiceRoleKey = Deno.env.get("CRONOGRAMA_SUPABASE_SERVICE_ROLE_KEY");

    if (!cronogramaUrl || !cronogramaServiceRoleKey) {
      console.error("Missing CRONOGRAMA_SUPABASE_URL or CRONOGRAMA_SUPABASE_SERVICE_ROLE_KEY in environment secrets.");
      return new Response(
        JSON.stringify({ error: "Target Cronograma database credentials not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase Client for Cronograma database (bypassing RLS with service_role key)
    const cronogramaDb = createClient(cronogramaUrl, cronogramaServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log(`Synchronizing order ${orderNumber}: status changed from '${oldStatus}' to '${newStatus}' (Mapped to '${cronogramaStatus}' in cronograma).`);

    // Perform UPDATE in cronograma database matching 'pedido' with 'orderNumber'
    const { data, error } = await cronogramaDb
      .from("cronograma")
      .update({ status: cronogramaStatus })
      .eq("pedido", orderNumber)
      .select();

    if (error) {
      console.error("Failed to update status in cronograma database:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update status in cronograma database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully updated cronograma records:`, JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, updatedCount: data?.length || 0, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error in Edge Function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
