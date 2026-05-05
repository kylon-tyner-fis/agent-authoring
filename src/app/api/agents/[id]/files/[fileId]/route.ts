import { DocumentService } from "@/src/lib/storage/DocumentService";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const resolvedParams = await params;
    const text = await DocumentService.getFileText(
      resolvedParams.id,
      resolvedParams.fileId,
    );
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const resolvedParams = await params;
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 },
      );
    }

    await DocumentService.updateFileText(
      resolvedParams.id,
      resolvedParams.fileId,
      text,
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating file:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const resolvedParams = await params;
    await DocumentService.deleteFile(resolvedParams.id, resolvedParams.fileId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
