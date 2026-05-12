import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { SkillConfig } from "@/src/lib/types/constants";
import { generateManifest } from "@/src/lib/runtime/manifest-compiler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function bumpVersion(v: string) {
  const num = parseInt(v, 10);
  return isNaN(num) ? "1" : (num + 1).toString();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: headId } = await params; // This is the ID the user is editing
    const config: SkillConfig = await req.json();

    // 1. Fetch dependencies for the manifest snapshot
    const [toolsRes, serversRes] = await Promise.all([
      supabase.from("tools").select("*").eq("project_id", config.project_id),
      supabase
        .from("mcp_servers")
        .select("*")
        .eq("project_id", config.project_id),
    ]);

    // 2. Compile the manifest for the snapshot
    const compiledManifest = generateManifest(
      config,
      toolsRes.data || [],
      serversRes.data || [],
    );

    // 3. CREATE THE SNAPSHOT (New ID, Published status)
    const snapshotPayload = {
      ...config,
      id: randomUUID(), // New unique ID for this version
      parent_id: headId, // Link back to the main skill
      status: "published",
      compiled_manifest: compiledManifest,
      version: config.version, // Keep the version we just finalized
      updated_at: new Date().toISOString(),
    };

    const { error: snapshotError } = await supabase
      .from("skills")
      .insert([snapshotPayload]);
    if (snapshotError) throw snapshotError;

    // 4. UPDATE THE HEAD (Keep ID, Increment Version, Status: Draft)
    const nextVersion = bumpVersion(config.version || "1");
    const { data: updatedHead, error: headError } = await supabase
      .from("skills")
      .update({
        version: nextVersion,
        status: "draft",
      })
      .eq("id", headId)
      .select()
      .single();

    if (headError) throw headError;

    // Return the updated Head record so the UI increments version and stays on 'Draft'
    return NextResponse.json({ success: true, skill: updatedHead });
  } catch (error: any) {
    console.error("Publish Skill Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
