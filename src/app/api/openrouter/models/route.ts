import { connection } from "next/server";
import { getOpenRouterCatalog } from "@/server/openRouterCatalog";

export async function GET() {
  await connection();
  try {
    return Response.json({ models: (await getOpenRouterCatalog()).models });
  } catch (error) {
    return Response.json({ models: [], error: `Could not load OpenRouter models: ${(error as Error).message}` }, { status: 502 });
  }
}
