import Anthropic from "@anthropic-ai/sdk";
import type { Provider, StopReason } from "../types";

export function createAnthropic({ apiKey }: { apiKey: string }): Provider {
  const client = new Anthropic({ apiKey });
  return {
    name: "Anthropic",
    defaultModel: "claude-sonnet-5",
    async *stream({ messages, model, system }) {
      const stream = client.messages.stream({
        model,
        max_tokens: 1000,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      let text = "";
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          text = event.delta.text;
          yield { type: "text_delta", delta: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      const stopReason: StopReason =
        final.stop_reason === "max_tokens" ? "length" : "stop";

      yield {
        type: "done",
        messages: {
          role: "assistant",
          content: text,
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
