#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import open from "open";

const ADORABLE_BASE_URL = process.env.ADORABLE_BASE_URL || "http://localhost:3000";
const ADORABLE_API_KEY = process.env.ADORABLE_API_KEY;

if (!ADORABLE_API_KEY) {
  console.error("ADORABLE_API_KEY environment variable is required");
  process.exit(1);
}

interface ComponentGenerationArgs {
  description: string;
  framework?: "react" | "vue" | "angular";
  styling?: "tailwind" | "css" | "styled-components";
}

interface SessionStatusArgs {
  sessionId: string;
}

interface SelectComponentArgs {
  sessionId: string;
  variationId: string;
}

class AdorableComponentGeneratorServer {
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
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_component",
          description: "Generate 5 variations of a UI component and open gallery for selection. Waits for user to select their preferred component.",
          inputSchema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Description of the component to generate (e.g., 'pricing cards', 'login form')",
              },
              framework: {
                type: "string",
                enum: ["react", "vue", "angular"],
                description: "Frontend framework to use",
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

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === "generate_component") {
          return await this.handleGenerateComponent(args as any);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `❌ Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async makeApiCall(endpoint: string, options: any = {}) {
    const url = `${ADORABLE_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ADORABLE_API_KEY}`,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API call failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async handleGenerateComponent(args: ComponentGenerationArgs) {
    const { description, framework = "react", styling = "tailwind" } = args;

    if (!description) {
      throw new Error("Description is required");
    }

    console.log(`Generating component: ${description} (${framework}, ${styling})`);

    try {
      // Create component generation session
      const sessionData = await this.makeApiCall("/api/mcp/component-gallery", {
        method: "POST",
        body: JSON.stringify({
          description,
          framework,
          styling,
        }),
      }) as { sessionId: string; status: string; galleryUrl: string };

      const fullGalleryUrl = `${ADORABLE_BASE_URL}${sessionData.galleryUrl}`;
      
      console.log(`Session created: ${sessionData.sessionId}, waiting for user selection...`);

      // Wait for user to select a component
      const selectedComponent = await this.waitForComponentSelection(sessionData.sessionId, fullGalleryUrl, description, framework);

      const styleNames = [
        "Modern & Minimalist",
        "Bold & Vibrant", 
        "Elegant & Professional",
        "Playful & Colorful",
        "Clean & Simple"
      ];
      const styleName = styleNames[selectedComponent.variationIndex] || `Variation ${selectedComponent.variationIndex + 1}`;

      return {
        content: [
          {
            type: "text",
            text: `🎉 **Component Selected Successfully!**

**Selected Style:** ${styleName}
**Framework:** ${framework} with ${styling}

📋 **Component Code:**

\`\`\`${framework === 'vue' ? 'vue' : 'tsx'}
${selectedComponent.code}
\`\`\`

**Implementation Instructions:**
1. Copy the code above into your project
2. Install any required dependencies (typically already in your project) 
3. Import and use the component in your application
4. Customize colors, spacing, or content as needed

*The component is ready to use in your ${framework} application!*`,
          },
        ],
      };
    } catch (error) {
      console.error("Error in handleGenerateComponent:", error);
      throw error;
    }
  }

  private async waitForComponentSelection(sessionId: string, galleryUrl: string, description: string, framework: string): Promise<{ code: string; variationIndex: number }> {
    console.log(`Waiting for component selection for session: ${sessionId}`);
    
    // Send initial message with gallery link and open browser
    await new Promise(resolve => {
      console.log(`🎨 Component Generation Started!
      
Gallery URL: ${galleryUrl}
Session ID: ${sessionId}
Description: ${description} (${framework})

Generating 5 variations:
• Modern & Minimalist
• Bold & Vibrant  
• Elegant & Professional
• Playful & Colorful
• Clean & Simple

🌐 Opening gallery in your browser...`);
      
      // Automatically open the gallery in the default browser
      open(galleryUrl).catch((error) => {
        console.error(`Failed to open gallery URL automatically: ${error}`);
        console.log(`Please manually open: ${galleryUrl}`);
      });
      
      // Give user a moment to see the message and browser to open
      setTimeout(resolve, 2000);
    });

    // Poll for selection (with timeout) - simplified for testing
    const maxAttempts = 60; // 5 minutes (5 second intervals)
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const sessionStatus = await this.makeApiCall(`/api/mcp/component-gallery/${sessionId}`) as {
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
        };

        // Check if user has made a selection
        if (sessionStatus.session.status === "completed" && sessionStatus.session.selectedVariationId) {
          const selectedVariation = sessionStatus.variations.find(v => 
            v.id === sessionStatus.session.selectedVariationId
          );
          
          if (selectedVariation && selectedVariation.code) {
            console.log(`Component selected: ${selectedVariation.id}`);
            return {
              code: selectedVariation.code,
              variationIndex: selectedVariation.variationIndex
            };
          }
        }

        // Log progress less frequently
        if (attempt % 12 === 0) { // Every 60 seconds
          console.log(`Waiting for user selection... (attempt ${attempt + 1}/${maxAttempts})`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`Error polling session ${sessionId}:`, error);
        if (attempt > 5) { // Only throw after a few attempts
          throw new Error(`Failed to poll session status: ${error}`);
        }
      }
    }

    throw new Error(`Timeout: No component was selected within 5 minutes. Please try again.`);
  }



  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Adorable Component Generator MCP Server running on stdio");
  }
}

// Start the server
const server = new AdorableComponentGeneratorServer();
server.run().catch(console.error);
