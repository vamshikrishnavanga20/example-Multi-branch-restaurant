import Groq from "groq-sdk";
import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_SQL_LENGTH = 6000;

export function createGroqClient() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description:
        "Execute exactly one read-only PostgreSQL SELECT query against the restaurant database. Use this whenever the user asks for business data, sales, revenue, orders, dishes, quantities, rankings, or recommendations based on sales data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "One PostgreSQL SELECT query only. The query must read from ledger_entries and/or menu_items and must not modify data.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];
