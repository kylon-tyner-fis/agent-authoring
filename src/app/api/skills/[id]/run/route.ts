import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeAgentManifest } from "@/src/lib/runtime/skill-executor";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { skillId, input, threadId, resumeData } = await req.json();

    if (!skillId || !threadId) {
      return NextResponse.json(
        { error: "Missing skillId or threadId." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("skills")
      .select("compiled_manifest")
      .eq("id", skillId)
      .single();

    if (error || !data?.compiled_manifest) {
      return NextResponse.json(
        { error: "Skill not found or no compiled manifest available." },
        { status: 404, headers: corsHeaders },
      );
    }

    const result = await executeAgentManifest(
      data.compiled_manifest,
      input,
      threadId,
      resumeData,
    );

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
}
