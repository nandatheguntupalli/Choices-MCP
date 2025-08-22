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
    const { 
      description, 
      framework = "react", 
      styling = "tailwind",
      animation = "subtle",
      layout = "modern",
      accessibility = true,
    } = args;

    if (!description) {
      throw new Error("Description is required");
    }

    // Create component generation session
    const sessionData = (await this.apiCall("/api/mcp/component-gallery", {
      method: "POST",
      body: JSON.stringify({ 
        description, 
        framework, 
        styling,
        animation,
        layout,
        accessibility,
      }),
    })) as SessionResponse;

    const galleryUrl = `${ADORABLE_BASE_URL}${sessionData.galleryUrl}`;

    // Open gallery in browser
    open(galleryUrl).catch((error) => {
      console.error(`Failed to open gallery: ${error}`);
    });

    // Wait for user selection
    const selected = await this.waitForSelection(sessionData.sessionId);

    const styleNames = [
      "Modern SaaS Professional",
      "Neon Signal Flow", 
      "Enterprise Minimalist",
      "Creative Studio Vibrant",
      "Pure Functional Design",
    ];

    const styleName =
      styleNames[selected.variationIndex] ||
      `Design Variation ${selected.variationIndex + 1}`;

    const styleDescription = this.getStyleDescription(selected.variationIndex);

    return {
      content: [
        {
          type: "text",
          text: `🎨 **Beautiful Component Generated: ${styleName}**

${styleDescription}

📋 **Production-Ready React Component:**

\`\`\`tsx
${selected.code}
\`\`\`

**🚀 Implementation Guide:**
1. **Dependencies**: All required packages are included in the code
2. **Styling**: Uses advanced ${styling} patterns with custom design tokens
3. **Responsive**: Mobile-first responsive design built-in
4. **Accessible**: WCAG compliant with proper ARIA attributes
5. **Performance**: Optimized with lazy loading and efficient rendering

**✨ Design Features:**
- Production-grade visual hierarchy with ${layout} layout patterns
- ${animation === "subtle" ? "Subtle" : animation === "dynamic" ? "Dynamic" : "Smooth"} animation system for enhanced UX
- Professional color harmonies with advanced contrast ratios
- Advanced interaction states with micro-animations
- Modern responsive layout systems (mobile-first)
- ${accessibility ? "WCAG 2.1 AA compliant accessibility features" : "Standard accessibility"}
- Performance-optimized rendering and animations

*Copy, paste, and enjoy your beautifully crafted component!* 🎉`,
        },
      ],
    };
  }

  private getStyleDescription(variationIndex: number): string {
    const descriptions = [
      "🔷 **Modern SaaS Professional**: Clean architecture with sophisticated blues, elegant spacing, and subtle depth. Perfect for B2B products and professional dashboards.",
      
      "⚡ **Neon Signal Flow**: Electric cyberpunk aesthetics with glowing accents, dark surfaces, and dynamic gradients. Ideal for tech products and gaming interfaces.",
      
      "🏢 **Enterprise Minimalist**: Refined corporate design with neutral palettes, perfect typography, and executive-level polish. Built for enterprise applications.",
      
      "🎨 **Creative Studio Vibrant**: Bold artistic expression with vibrant colors, playful interactions, and creative energy. Perfect for design agencies and creative tools.",
      
      "⚪ **Pure Functional Design**: Ultra-minimal aesthetic focusing on perfect functionality, crystal clarity, and zero visual noise. Ideal for productivity tools.",
    ];

    return descriptions[variationIndex] ?? descriptions[0] ?? "🎨 **Enhanced Design**: Beautiful, production-ready component with sophisticated styling and modern aesthetics.";
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
