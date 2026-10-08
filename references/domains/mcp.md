# Domain: MCP servers and clients

Anchors were written from memory in 2026 and are starting points only.
Check their current status with `inspect` before relying on them.

## Vocabulary

MCP server, MCP client, model context protocol, tool server, `<product> mcp`,
mcp bridge, mcp adapter, mcp gateway, mcp proxy, stdio server, streamable HTTP,
remote MCP, MCP bundle (`.mcpb`), DXT, Claude Code plugin, agent tools.

## Where to look

- Official MCP registry: https://registry.modelcontextprotocol.io (packages declare a `server.json`)
- Reference servers: github.com/modelcontextprotocol/servers (also lists community servers)
- Community catalogs: awesome-mcp-servers lists (search "awesome mcp servers"), Glama, Smithery, mcp.so
- SDKs (to find users of them): `@modelcontextprotocol/sdk` (TS), `mcp` (Python, includes FastMCP), plus the Go, Rust, C#, Java and Kotlin SDKs
- Often the best option is the target product's **own official MCP server**. Search the vendor's GitHub org first.

## Proof terms

SDK-level: `McpServer`, `Server(`, `StdioServerTransport`, `StreamableHTTPServerTransport`,
`FastMCP`, `@mcp.tool`, `server.tool(`, `registerTool`, `ListToolsRequestSchema`.

Protocol-level (catches hand-rolled implementations): `tools/list`, `tools/call`,
`inputSchema`, `jsonrpc`, `notifications/`, `resources/list`, `prompts/list`.

Quality probes: `inputSchema` with real property descriptions, error handling
(`isError`), tests that speak the protocol (spawn the server and send `tools/list`).

## Gotchas

- Many MCP servers are thin wrappers around a CLI or REST API. Judge the
  underlying tool too, and check whether calling that API directly would be simpler.
- Count and quality of tools matter more than stars. Read the tool list: are the
  tools coarse ("run_script") or meaningful, typed operations?
- Transport: stdio only versus streamable HTTP; auth for remote servers; which
  MCP spec revision it targets.
- Security: servers run with the user's permissions. Check what they can touch
  (shell exec, file system scope, network) before USE.
- Duplicates abound: several independent "<product>-mcp" repos usually exist.
  Prefer official or most-used, and compare tool coverage.
