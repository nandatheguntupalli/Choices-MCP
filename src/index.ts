#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ComponentGenerationServer } from './server.js';

async function main() {
  const transport = new StdioServerTransport();
  const server = new ComponentGenerationServer();
  
  await server.connect(transport);
  
  // Keep the server running
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
