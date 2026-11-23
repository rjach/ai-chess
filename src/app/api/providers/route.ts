import { connection } from "next/server";
import { getProviderStatuses } from "@/server/providerStatus";

export async function GET() {
  await connection();
  return Response.json({ providers: await getProviderStatuses() });
}
