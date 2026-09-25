export type DateFilter = "today" | "7d" | "30d" | "custom";

export type RequestRange =
  | { kind: "today" | "7d" | "30d" }
  | { kind: "custom"; startDate: string; endDate: string };

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RequestBody = {
  mode?: "chat";
  userPrompt?: string;
  history?: ChatHistoryMessage[];
  timeframe?: DateFilter;
  range?: RequestRange;
};

export type ReportRow = {
  "Dish Name": string;
  "Units Sold": number;
  Revenue: number;
};

export type TableColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "currency";
};

export type ResolvedRange = {
  kind: "today" | "7d" | "30d" | "custom";
  startDate: string;
  endDate: string;
  displayStartDate: string;
  displayEndDate: string;
};
