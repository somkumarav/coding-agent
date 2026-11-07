import { fileURLToPath } from "bun";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { getProvider } from "./providers";
import type { Message } from "./types";

config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    model: { type: "string", short: "m" },
  },
});

if (!values.prompt || values.prompt === "") {
  console.error("Prompt required");
  process.exit(1);
}

const provider = getProvider("anthropic");
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

for await (const event of provider.stream({ messages, model, system: "" })) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  } else {
    const { usage, stopReason } = event.messages;
    console.log(
      `\n\n${provider.name}...${model}...${usage.input}...${usage.output}...${stopReason}`,
    );
  }
}
