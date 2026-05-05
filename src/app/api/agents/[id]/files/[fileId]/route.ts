import {
  DocumentService,
  DocumentServiceError,
} from "@/src/lib/storage/DocumentService";
import { NextResponse } from "next/server";

function toErrorResponse(error: unknown) {
  if (error instanceof DocumentServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        details: { cause: message },
      },
    },
    { status: 500 },
  );
}

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
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const resolvedParams = await params;
    const { text } = await req.json();
    if (typeof text !== "string" || text.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TEXT_PAYLOAD",
            message: "Text content is required.",
          },
        },
        { status: 400 },
      );
    }

    await DocumentService.updateFileText(
      resolvedParams.id,
      resolvedParams.fileId,
      text,
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating file:", error);
    return toErrorResponse(error);
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
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}
