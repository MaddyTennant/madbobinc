import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/rbac";
import { UnauthorizedError } from "@/lib/tenant";
import { ApiKeyScopeError } from "@/lib/apikeys";

export function toApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ForbiddenError || error instanceof ApiKeyScopeError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  console.error("Unknown error", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
