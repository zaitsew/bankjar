import { llmsTxt } from "../../src/server/llms";
import { textResponse } from "../../src/server/http";

export const revalidate = 3600;

export function GET(): Response {
  return textResponse(llmsTxt());
}

