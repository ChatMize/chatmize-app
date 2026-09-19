/**
 * ChatMize MCP server (v1, BETA).
 *
 * Builds a per-request McpServer bound to the workspace resolved from the
 * caller's API key. Stateless transport: no sessions, every request is
 * independent — ideal for serverless scale-to-zero.
 *
 * Pilot target (per Karl's decision 20): Karl's GoHighLevel account is the
 * first integration to build against this API.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VerifiedKey } from "./auth";
import {
  listConversations,
  readConversation,
  sendMessage,
  searchContacts,
  getContact,
  updateContact,
  sendWebhook,
  createBroadcast,
  sheetsAppendRow,
  sheetsReadRows,
  sheetsListTabs,
  type ToolContext,
} from "./tools";

const SERVER_NAME = "chatmize";
const SERVER_VERSION = "1.0.0";

const INSTRUCTIONS = [
  "BETA: the ChatMize MCP API is in beta. Report anything strange via ChatMize support.",
  "You are operating a ChatMize workspace on behalf of its owner. Every tool is",
  "scoped to the workspace your API key belongs to; you cannot see or touch",
  "any other workspace.",
  "Conversations are identified by conversationId (e.g. instagram_123456).",
  "Use list_conversations to discover threads, read_conversation for history,",
  "and send_message to reply (pass conversationId and the bot resolves the recipient).",
  "SMS sends require prior opt-in and consume the workspace SMS allowance/credits.",
  "API keys are managed in the agency dashboard (one key per workspace).",
].join(" ");

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true as const };
}

export function buildMcpServer(key: VerifiedKey): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );
  const ctx: ToolContext = { key, workspaceId: key.workspaceId };

  server.tool(
    "list_conversations",
    "List recent conversation threads in this workspace, newest first.",
    {
      channel: z.enum(["messenger", "instagram", "whatsapp", "sms"]).optional()
        .describe("Filter to one channel."),
      limit: z.number().int().min(1).max(100).optional().describe("Max threads (default 20)."),
    },
    async (args) => {
      try {
        return textResult(await listConversations(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "read_conversation",
    "Read message history for one conversation thread, oldest first.",
    {
      conversationId: z.string().describe("Thread id, e.g. instagram_17841402135533383."),
      limit: z.number().int().min(1).max(200).optional().describe("Max messages (default 50)."),
    },
    async (args) => {
      try {
        return textResult(await readConversation(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "send_message",
    "Send one outbound message through the workspace's connected channels. Uses the production send pipeline (token self-heal, personalization tags, SMS opt-in and billing). Supports text and media attachments (video/audio on Messenger and Instagram).",
    {
      channel: z.enum(["messenger", "instagram", "whatsapp", "sms"]),
      recipientId: z.string().optional()
        .describe("PSID / IGSID / WhatsApp number / E.164 phone. Omit when conversationId is given."),
      conversationId: z.string().optional()
        .describe("Reply inside this thread; the recipient is resolved from it."),
      text: z.string().max(1600).optional().describe("Message text. {{contact tags}} are resolved automatically. Optional when mediaUrl is given."),
      mediaUrl: z.string().url().optional()
        .describe("Publicly fetchable media URL (e.g. a Firebase Storage download URL). Sent as a Messenger/Instagram attachment."),
      mediaType: z.enum(["video", "audio", "image"]).optional()
        .describe("Attachment type for mediaUrl. Required when mediaUrl is given."),
      quickReplies: z.array(z.string()).max(13).optional()
        .describe("Quick reply buttons (max 13, 20 chars each). Meta text-first rule: always sent with the text message, never the media. Ignored on WhatsApp/SMS."),
      contactCaptureFields: z.array(z.enum(["phone", "email"])).optional()
        .describe("Contact capture: send the text with one-tap phone/email quick replies attached. The reply is validated and saved to the contact."),
      contactCaptureMode: z.enum(["quick_reply", "free_text", "both"]).optional()
        .describe("Capture mode: one-tap quick reply, typed text, or both. Defaults to both."),
      variableCapture: z.object({
        variable: z.string().describe("Variable name to save the answer to, e.g. appointment_date."),
        varType: z.enum(["text", "number", "date"]).optional().describe("Answer type. Dates normalize to YYYY-MM-DD. Defaults to text."),
      }).optional()
        .describe("Question block: send the text as a question, then validate the reply and save it to the named variable on the contact."),
    },
    async (args) => {
      try {
        return textResult(await sendMessage(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "search_contacts",
    "Search contacts in this workspace by name, email, phone, or company.",
    {
      query: z.string().describe("Substring to match."),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
    },
    async (args) => {
      try {
        return textResult(await searchContacts(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "get_contact",
    "Get a contact's full record, including the variables map (named variables saved by BotMaps question blocks, usable as {{variable}} tags).",
    {
      contactId: z.string().describe("Contact id, e.g. contact_instagram_123456."),
    },
    async (args) => {
      try {
        return textResult(await getContact(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "update_contact",
    "Update allowlisted fields on a contact: name, firstName, lastName, email, phone, company, jobTitle, city, state, country, zipCode, notes, tags, status. Plus a variables object to set any named variable (BotMaps answers, dates, etc.), readable later as {{variable}} tags.",
    {
      contactId: z.string(),
      fields: z.record(z.string(), z.unknown()).describe("Fields to patch."),
      variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe("Named variables to save on the contact, e.g. { appointment_date: '2027-01-05' }. Usable as {{appointment_date}} in later messages."),
    },
    async (args) => {
      try {
        return textResult(await updateContact(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "send_webhook",
    "POST a contact's collected variables to a third party URL as JSON ({ contactId, workspaceId, variables, sentAt }). HTTPS only; private hosts refused; 10s timeout; no retries.",
    {
      contactId: z.string().describe("Contact id, e.g. contact_instagram_123456."),
      url: z.string().url().describe("HTTPS endpoint that receives the variables."),
      variableNames: z.array(z.string()).optional()
        .describe("Only push these variables. Omit to push every variable on the contact."),
    },
    async (args) => {
      try {
        return textResult(await sendWebhook(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "create_broadcast",
    "Start an SMS broadcast to opted-in numbers (v1: sms only). Idempotent via idempotencyKey; returns a delivery report.",
    {
      channel: z.enum(["sms"]).describe("v1 supports sms only."),
      body: z.string().max(1600).describe("Message body; {{contact tags}} resolved per recipient."),
      phones: z.array(z.string()).optional()
        .describe("Explicit recipients. Omit to broadcast to every opted-in number."),
      idempotencyKey: z.string().optional()
        .describe("Client key; retries with the same key resume instead of re-sending."),
    },
    async (args) => {
      try {
        return textResult(await createBroadcast(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sheets_append_row",
    "Append one row to a tab of the workspace's connected Google Sheet. Values map column header to cell value; cells land under the matching header. The tab needs a header row (row 1).",
    {
      tab: z.string().describe("Tab name, e.g. Leads."),
      values: z.record(z.string(), z.string()).describe("Column header to cell value, e.g. { Name: 'Jo', Email: 'jo@x.com' }."),
      spreadsheetId: z.string().optional()
        .describe("Override the workspace's chosen spreadsheet. Omit to use it."),
    },
    async (args) => {
      try {
        return textResult(await sheetsAppendRow(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sheets_read_rows",
    "Read rows from a tab of the workspace's connected Google Sheet. The first row is treated as headers; rows come back keyed by header.",
    {
      tab: z.string().describe("Tab name, e.g. Leads."),
      matchHeader: z.string().optional()
        .describe("Only return rows where this column equals matchValue."),
      matchValue: z.string().optional()
        .describe("Value to match in matchHeader."),
      limit: z.number().int().min(1).max(500).optional()
        .describe("Max rows (default 100)."),
      spreadsheetId: z.string().optional()
        .describe("Override the workspace's chosen spreadsheet. Omit to use it."),
    },
    async (args) => {
      try {
        return textResult(await sheetsReadRows(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sheets_list_tabs",
    "List the tabs of the workspace's connected Google Sheet with their header rows, so you can see where to append or read.",
    {
      spreadsheetId: z.string().optional()
        .describe("Override the workspace's chosen spreadsheet. Omit to use it."),
    },
    async (args) => {
      try {
        return textResult(await sheetsListTabs(ctx, args));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  return server;
}
