#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import open from "open";

const ADORABLE_BASE_URL =
  process.env.ADORABLE_BASE_URL || "http://localhost:3000";
const ADORABLE_API_KEY = process.env.ADORABLE_API_KEY;

if (!ADORABLE_API_KEY) {
  console.error("ADORABLE_API_KEY environment variable is required");
  process.exit(1);
}



interface SessionResponse {
  sessionId: string;
  status: string;
  galleryUrl: string;
}

interface SessionStatus {
  session: {
    status: string;
    selectedVariationId?: string;
  };
  variations: Array<{
    id: string;
    variationIndex: number;
    code: string;
    status: string;
  }>;
}

class ComponentGeneratorServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "adorable-component-generator",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_component",
          description:
            "Generate 5 variations of a UI component and open gallery for selection. Waits for user to select their preferred component.",
          inputSchema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description:
                  "Description of the component to generate (e.g., 'pricing cards', 'login form')",
              },
              framework: {
                type: "string",
                enum: ["react"],
                description: "Frontend framework to use (React only)",
                default: "react",
              },
              styling: {
                type: "string",
                enum: ["tailwind", "css", "styled-components"],
                description: "Styling approach to use",
                default: "tailwind",
              },
            },
            required: ["description"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name !== "generate_component") {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        return await this.generateComponent(args as any);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    });
  }

  private async apiCall(endpoint: string, options: any = {}) {
    const response = await fetch(`${ADORABLE_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADORABLE_API_KEY}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API call failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async generateComponent(args: any) {
    const { description, framework = "react", styling = "tailwind" } = args;

    if (!description) {
      throw new Error("Description is required");
    }

    console.log(
      `Generating component: ${description} (${framework}, ${styling})`,
    );

    // Create component generation session
    const sessionData = (await this.apiCall("/api/mcp/component-gallery", {
      method: "POST",
      body: JSON.stringify({ description, framework, styling }),
    })) as SessionResponse;

    const galleryUrl = `${ADORABLE_BASE_URL}${sessionData.galleryUrl}`;

    console.log(`Session created: ${sessionData.sessionId}`);
    console.log(`🌐 Opening gallery: ${galleryUrl}`);

    // Open gallery in browser
    open(galleryUrl).catch((error) => {
      console.error(`Failed to open gallery: ${error}`);
    });

    // Wait for user selection
    const selected = await this.waitForSelection(sessionData.sessionId);

    const styleNames = [
      "Modern & Minimalist",
      "Bold & Vibrant",
      "Elegant & Professional",
      "Playful & Colorful",
      "Clean & Simple",
    ];

    const styleName =
      styleNames[selected.variationIndex] ||
      `Variation ${selected.variationIndex + 1}`;

    return {
      content: [
        {
          type: "text",
          text: `🎉 **Component Selected: ${styleName}**

📋 **${framework.charAt(0).toUpperCase() + framework.slice(1)} Component Code:**

\`\`\`${framework === "vue" ? "vue" : "tsx"}
${selected.code}
\`\`\`

**Implementation:**
1. Copy the code above into your project
2. Install dependencies if needed (usually already available)
3. Import and use the component
4. Customize as needed

*Ready to use in your ${framework} application!*`,
        },
      ],
    };
  }

  private async waitForSelection(
    sessionId: string,
  ): Promise<{ code: string; variationIndex: number }> {
    const maxAttempts = 60; // 5 minutes
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = (await this.apiCall(
          `/api/mcp/component-gallery/${sessionId}`,
        )) as SessionStatus;

        // Check if user selected a component
        if (
          status.session.status === "completed" &&
          status.session.selectedVariationId
        ) {
          const selected = status.variations.find(
            (v) => v.id === status.session.selectedVariationId,
          );

          if (selected?.code) {
            console.log(
              `Component selected: variation ${selected.variationIndex}`,
            );
            return {
              code: selected.code,
              variationIndex: selected.variationIndex,
            };
          }
        }

        // Log progress occasionally
        if (attempt % 12 === 0) {
          const readyCount = status.variations.filter(
            (v) => v.status === "ready",
          ).length;
          console.log(
            `Progress: ${readyCount}/5 ready, waiting for selection...`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (attempt > 5) {
          throw new Error(`Failed to poll session: ${error}`);
        }
      }
    }

    throw new Error("Timeout: No component selected within 5 minutes");
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Component Generator MCP Server running");
  }
}

// Start server
const server = new ComponentGeneratorServer();
server.run().catch(console.error);
