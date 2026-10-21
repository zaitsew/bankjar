import { goalsBody } from "../../../../src/server/api";
import { jsonResponse } from "../../../../src/server/http";

export const revalidate = 3600;

export function GET(): Response {
  return jsonResponse(goalsBody());
}

