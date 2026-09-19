import Anthropic from "@anthropic-ai/sdk";
import { MAX_TOKENS, MAX_TOOL_ROUNDS, MODEL } from "./config";
import type { Emit, ErrorCode } from "./events";
import { SYSTEM } from "./prompt";
import { TOOLS, runTool } from "./tools";

/** One model call: streams text deltas out, resolves with the finished message. */
export type StreamFn = (
  messages: Anthropic.MessageParam[],
  onText: (delta: string) => void,
  allowTools: boolean,
) => Promise<Anthropic.Message>;

export class AgentError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

/** The real StreamFn. The system breakpoint shares tools + system across visitors; the top-level one caches each conversation. */
export function claudeStream(client: Anthropic): StreamFn {
  return async (messages, onText, allowTools) => {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low" },
      system: SYSTEM,
      tools: TOOLS,
      tool_choice: { type: allowTools ? "auto" : "none" },
      cache_control: { type: "ephemeral" },
      messages,
    });
    stream.on("text", onText);
    const message = await stream.finalMessage();
    console.log(JSON.stringify({ stop: message.stop_reason, usage: message.usage }));
    return message;
  };
}

function textOnly(content: Anthropic.ContentBlock[]): Anthropic.TextBlockParam[] {
  const texts = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => ({ type: "text" as const, text: b.text }));
  return texts.length ? texts : [{ type: "text", text: "…" }];
}

/**
 * One visitor turn: the model answers, may call tools, and answers again, for up to
 * MAX_TOOL_ROUNDS tool rounds. Returns the turns to append to history, starting with
 * the visitor's own. Throws AgentError when there is nothing safe to keep.
 */
export async function runTurn(
  stream: StreamFn,
  history: Anthropic.MessageParam[],
  userTurn: Anthropic.MessageParam,
  emit: Emit,
): Promise<Anthropic.MessageParam[]> {
  const append: Anthropic.MessageParam[] = [userTurn];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let message: Anthropic.Message;
    try {
      message = await stream(
        [...history, ...append],
        (delta) => emit({ event: "text", data: { delta } }),
        round < MAX_TOOL_ROUNDS,
      );
    } catch (err) {
      console.error(err instanceof Anthropic.APIError ? `anthropic ${err.status}: ${err.message}` : String(err));
      throw new AgentError("unavailable");
    }
    if (message.stop_reason === "refusal") throw new AgentError("refused");

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      // Cut off at max_tokens, a reply may end in a half-written tool call: keep only its text.
      append.push({ role: "assistant", content: message.stop_reason === "max_tokens" ? textOnly(message.content) : message.content });
      return append;
    }
    append.push({ role: "assistant", content: message.content });
    append.push({ role: "user", content: toolUses.map((b) => runTool(b, emit)) });
  }
  // Only reachable if the model called a tool with tools switched off.
  throw new AgentError("unavailable");
}
