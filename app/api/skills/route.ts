import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("skills")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ skills: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const skill = await req.json();
    const { data, error } = await supabase
      .from("skills")
      .upsert([skill], { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, skill: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
