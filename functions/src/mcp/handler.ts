/**
 * Express handler mounting the ChatMize MCP server (Streamable HTTP).
 *
 * Auth: Authorization: Bearer <workspace API key> (v1; OAuth later).
 * Transport: stateless — every POST is independent, no sessions, which is
 * what lets the function scale to zero between calls.
 */
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyApiKey, checkRateLimit, McpAuthError } from "./auth";
import { buildMcpServer } from "./server";

function setCors(res: Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function bearerToken(req: Request): string {
  const h = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : "";
}

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    // Stateless mode serves JSON-RPC over POST only.
    res.status(405).json({ error: "Method not allowed. POST JSON-RPC to this endpoint." });
    return;
  }

  try {
    const key = await verifyApiKey(bearerToken(req));
    await checkRateLimit(key);

    const server = buildMcpServer(key);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    transport.onerror = (err) => {
      // Logged per-request; the JSON-RPC error already went to the client.
      console.error("MCP transport error", { keyId: key.keyId, err: String(err) });
    };
    await server.connect(transport);
    await transport.handleRequest(req as never, res as never, req.body);
  } catch (err) {
    if (err instanceof McpAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("MCP request failed", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error handling the MCP request." });
    }
  }
}
