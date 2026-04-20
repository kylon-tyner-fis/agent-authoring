// authoring-app/app/api/execute/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeAgentManifest } from "@/lib/engine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 1. Define CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allows any origin to call this API
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 2. Handle the OPTIONS preflight request (Required for CORS)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { agentId, input, threadId, resumeData } = await req.json();

    if (!agentId || !threadId) {
      return NextResponse.json(
        { error: "Missing agentId or threadId." },
        { status: 400, headers: corsHeaders }, // Add headers to errors too!
      );
    }

    const { data, error } = await supabase
      .from("agents")
      .select("compiled_manifest")
      .eq("agent_id", agentId)
      .single();

    if (error || !data?.compiled_manifest) {
      return NextResponse.json(
        { error: "Agent not found or no compiled manifest available." },
        { status: 404, headers: corsHeaders },
      );
    }

    const result = await executeAgentManifest(
      data.compiled_manifest,
      input,
      threadId,
      resumeData,
    );

    // 3. Add CORS headers to the successful response
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
