import type {
  AssistantMessage,
  Message,
  Provider,
  Tool,
  ToolCallBlock,
} from "../types";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; call: ToolCallBlock }
  | { type: "tool_end"; call: ToolCallBlock; result: string; isError: boolean }
  | { type: "turn_end"; message: AssistantMessage }
  | { type: "message"; message: Message };

export type AgentOptions = {
  provider: Provider;
  model: string;
  system?: string;
  tools: Tool[];
  messages: Message[];
  maxTurns?: number;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions) {
  const { messages, model, provider, tools, system, onEvent } = opts;
  const maxTurns = opts.maxTurns ?? 25;
  const push = (message: Message) => {
    messages.push(message);
    onEvent({ type: "message", message });
  };

  for (let i = 1; i < maxTurns; i++) {
    // console.log("-------------Hello--------------");
    // console.dir({ messages }, { depth: null });
    let assistant: AssistantMessage | undefined;
    for await (const event of provider.stream({
      messages,
      model,
      system,
      tools,
    })) {
      // console.dir({ event }, { depth: null });
      if (event.type === "text_delta") {
        onEvent({ type: "text", delta: event.delta });
      } else {
        assistant = event.messages;
        // console.dir({ assistant }, { depth: null });
      }
    }
    if (!assistant) throw new Error("Assistant empty");
    push(assistant);
    onEvent({ type: "turn_end", message: assistant });

    if (assistant.stopReason !== "toolUse") return;

    for (const call of assistant.content) {
      if (call.type !== "toolCall") continue;
      onEvent({ type: "tool_start", call });
      let result: string;
      let isError = false;

      try {
        const tool = tools.find((t) => t.name === call.name);
        if (!tool) throw new Error("Invalid tool call, No such tool");
        result = await tool.execute(call.arguments);
      } catch (e) {
        result = `Error ${e instanceof Error ? e.message : String(e)}`;
        isError = true;
      }
      onEvent({ type: "tool_end", call, result, isError });
      push({
        role: "toolResult",
        content: result,
        isError,
        toolCallId: call.id,
        toolName: call.name,
      });
    }
  }
}
