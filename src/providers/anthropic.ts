import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, Message, Provider, StopReason } from "../types";

function toAnthropic(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((message): Anthropic.MessageParam => {
    if (message.role === "user")
      return { role: "user", content: message.content };
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content.map(
          (block): Anthropic.ContentBlockParam =>
            block.type === "text"
              ? { type: "text", text: block.text }
              : {
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: block.arguments,
                },
        ),
      };
    }
    return {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: message.toolCallId,
          content: message.content,
          is_error: message.isError,
        },
      ],
    };
  });
}

export function createAnthropic({ apiKey }: { apiKey: string }): Provider {
  const client = new Anthropic({ apiKey });
  return {
    name: "Anthropic",
    defaultModel: "claude-sonnet-5",
    async *stream({ messages, model, system, tools = [] }) {
      const stream = client.messages.stream({
        model,
        max_tokens: 1000,
        system,
        messages: toAnthropic(messages),
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool.InputSchema,
        })),
      });
      let text = "";
      const content: ContentBlock[] = [];
      let json = "";
      for await (const event of stream) {
        if (event.type === "content_block_start") {
          // console.log("\n-------content_block_start-------");
          // console.log(event);
          // console.log("\n");
          // console.log({ text, content, json });
          if (event.content_block.type === "text") {
            content.push({ type: "text", text: "" });
          } else if (event.content_block.type === "tool_use") {
            content.push({
              type: "toolCall",
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: {},
            });
            json = "";
          }
          // console.log("\n");
          // console.log({ text, content, json });
        } else if (event.type === "content_block_delta") {
          // console.log("\n-------content_block_delta-------");
          // console.log(event);
          // console.log("\n");
          // console.log({ text, content, json });
          const lastBlock = content.at(-1);
          if (event.delta.type === "text_delta" && lastBlock?.type === "text") {
            lastBlock.text += event.delta.text;
            yield { type: "text_delta", delta: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            json += event.delta.partial_json;
          }
          // console.log("\n");
          // console.log({ text, content, json });
        } else if (event.type === "content_block_stop") {
          // console.log("\n-------content_block_stop-------");
          // console.log(event);
          // console.log("\n");
          // console.log({ text, content, json });
          const block = content.at(-1);
          if (block?.type === "toolCall")
            block.arguments = json ? JSON.parse(json) : {};
          // console.log("\n");
          // console.log({ text, content, json });
        }
      }
      const final = await stream.finalMessage();
      const stopReason: StopReason =
        final.stop_reason === "tool_use"
          ? "toolUse"
          : final.stop_reason === "max_tokens"
            ? "length"
            : "stop";

      yield {
        type: "done",
        messages: {
          role: "assistant",
          content,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
          },
          stopReason,
        },
      };
    },
  };
}
