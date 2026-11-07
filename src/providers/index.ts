import type { Provider } from "../types";
import { createAnthropic } from "./anthropic";

const providers: Record<string, () => Provider> = {
  anthropic: () => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
};

export function getProvider(name: string): Provider {
  const create = providers[name];
  if (!create) {
    throw new Error("Something went wrong!");
  }
  return create();
}
