import { fileURLToPath } from "bun";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { getProvider } from "./providers";
import type { Message } from "./types";
import { readTool } from "./tools/read-file";
import { runAgent } from "./loop";

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

const tools = [readTool];

const provider = getProvider("anthropic");
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

await runAgent({
  provider,
  model,
  tools,
  messages,
  onEvent(event) {
    if (event.type === "text") process.stdout.write(event.delta);
    else if (event.type == "tool_start") console.log(`\n ${event.call.name}`);
    else if (event.type == "tool_end") {
      const lines = event.result.split("\n").length;
      console.log(`\n ${event.isError ? event.result : lines}`);
    } else if (event.type === "turn_end") {
      const { usage, stopReason } = event.message;
      console.log(
        `\n\n  ${provider.name} ... ${model} ... ${usage.input} ... ${usage.output} ... ${stopReason}`,
      );
    }
  },
});

// async function callModel(): Promise<AssistantMessage> {
//   for await (const event of provider.stream({
//     messages,
//     model,
//     system: "",
//     tools,
//   })) {
//     if (event.type === "text_delta") {
//       process.stdout.write(event.delta);
//     } else {
//       const { usage, stopReason } = event.messages;
//       console.log(
//         `\n\n${provider.name}...${model}...${usage.input}...${usage.output}...${stopReason}`,
//       );
//       return event.messages;
//     }
//   }
//   throw new Error("Stream ended without done event");
// }

// const first = await callModel();
// messages.push(first);

// if (first.stopReason === "toolUse") {
//   for (const block of first.content) {
//     if (block.type !== "toolCall") continue;
//     const result = await readTool.execute(block.arguments);
//     messages.push({
//       role: "toolResult",
//       toolCallId: block.id,
//       toolName: block.name,
//       content: result,
//       isError: false,
//     });
//   }
//   messages.push(await callModel());
// }
