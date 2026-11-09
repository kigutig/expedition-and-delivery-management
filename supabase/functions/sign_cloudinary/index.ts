async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    data
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const cloudinaryUrl =
      Deno.env.get("CLOUDINARY_URL");

    if (!cloudinaryUrl) {
      return new Response(
        JSON.stringify({
          error: "CLOUDINARY_URL not configured",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const parsed = new URL(cloudinaryUrl);

    const apiKey = parsed.username;
    const apiSecret = parsed.password;
    const cloudName = parsed.hostname;

    const body = await req.json().catch(() => ({}));

    const timestamp =
      body.timestamp ??
      Math.floor(Date.now() / 1000);

    const folder = body.folder;

    // Cloudinary exige ordenação estritamente alfabética dos parâmetros
    const params: Record<string, string | number> = {};
    if (folder) {
      params.folder = folder;
    }
    params.timestamp = timestamp;

    const paramsToSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    const signature = await sha1(
      paramsToSign + apiSecret
    );

    return new Response(
      JSON.stringify({
        signature,
        timestamp,
        api_key: apiKey,
        cloud_name: cloudName,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao gerar assinatura Cloudinary:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});