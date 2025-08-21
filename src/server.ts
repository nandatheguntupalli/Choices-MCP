import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { AdorableApiClient } from './lib/adorable-auth.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ComponentGenerationRequest,
  ComponentGenerationResponse,
  ComponentSelectionResponse,
  AuthenticationError,
  SessionNotFoundError,
  ComponentNotFoundError,
  SessionExpiredError,
} from './types.js';

// Tool input schemas
const GenerateComponentSchema = z.object({
  description: z.string().describe('Description of the component to generate'),
  framework: z.enum(['react', 'vue', 'angular']).optional().default('react'),
  styling: z.enum(['tailwind', 'css', 'styled-components']).optional().default('tailwind'),
});

const SelectComponentSchema = z.object({
  sessionId: z.string().describe('The session ID from component generation'),
  componentId: z.string().describe('The ID of the component to select'),
});

const GetSessionStatusSchema = z.object({
  sessionId: z.string().describe('The session ID to check status for'),
});

export class ComponentGenerationServer {
  private server: Server;
  private apiClient: AdorableApiClient;
  private supabase: SupabaseClient;

  constructor() {
    this.server = new Server(
      {
        name: '@adorable/component-generator-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.apiClient = new AdorableApiClient();

    this.setupToolHandlers();
    this.setupErrorHandler();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      console.warn('Supabase env not set (SUPABASE_URL, SUPABASE_ANON_KEY). Selection hand-off requires these.');
    }
    this.supabase = createClient(supabaseUrl || '', supabaseAnon || '');
  }

  private setupErrorHandler(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_component',
          description: 'Generate 5 variations of a UI component and open gallery for selection',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description of the component to generate (e.g., "pricing cards", "login form", "navigation bar")',
              },
              framework: {
                type: 'string',
                enum: ['react', 'vue', 'angular'],
                description: 'The frontend framework to use',
                default: 'react',
              },
              styling: {
                type: 'string',
                enum: ['tailwind', 'css', 'styled-components'],
                description: 'The styling approach to use',
                default: 'tailwind',
              },
            },
            required: ['description'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Extract API key from environment or request context
        const apiKey = await this.extractApiKey();
        
        // Validate API key and get user info
        const authResult = await this.apiClient.validateApiKey(apiKey);
        if (!authResult.valid) {
          throw new AuthenticationError(authResult.error || 'Invalid API key');
        }

        const userId = authResult.userId!;

        if (name === 'generate_component') {
          return await this.handleGenerateComponent(userId, args);
        }
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw new McpError(ErrorCode.InvalidRequest, error.message);
        }
        if (error instanceof SessionNotFoundError || error instanceof ComponentNotFoundError) {
          throw new McpError(ErrorCode.InvalidRequest, error.message);
        }
        if (error instanceof SessionExpiredError) {
          throw new McpError(ErrorCode.InvalidRequest, error.message);
        }
        throw error;
      }
    });
  }

  private async extractApiKey(): Promise<string> {
    // In a real implementation, this would extract the API key from the MCP context
    // For now, we'll use environment variable or throw an error
    const apiKey = process.env.ADORABLE_API_KEY;
    if (!apiKey) {
      throw new AuthenticationError('No API key provided. Set ADORABLE_API_KEY environment variable.');
    }
    return apiKey;
  }

  private async handleGenerateComponent(
    userId: string,
    args: any,
  ): Promise<{ content: any[] }> {
    const parsed = GenerateComponentSchema.parse(args);
    
    // Create a new component generation session and start generation
    // The createSession method now calls /api/gallery/generate which handles all generation
    const session = await this.apiClient.createSession(userId, {
      description: parsed.description,
      framework: parsed.framework,
      styling: parsed.styling,
    });

    // Construct gallery URL
    const adorableBaseUrl = process.env.ADORABLE_BASE_URL || 'http://localhost:3000';
    const galleryUrl = `${adorableBaseUrl}/gallery/${session.id}`;

    // Prepare to wait for selection via WebSocket
    const selectionPromise = this.waitForSupabaseSelection(session.id);

    // Open gallery in browser automatically
    console.log(`Opening gallery: ${galleryUrl}`);
    
    // Execute system command to open browser (cross-platform)
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Determine the correct command based on the platform
      const platform = process.platform;
      let openCommand: string;
      
      if (platform === 'darwin') {
        // macOS
        openCommand = `open "${galleryUrl}"`;
      } else if (platform === 'win32') {
        // Windows
        openCommand = `start "" "${galleryUrl}"`;
      } else {
        // Linux and others
        openCommand = `xdg-open "${galleryUrl}"`;
      }
      
      await execAsync(openCommand);
      console.log(`Browser opened successfully: ${galleryUrl}`);
    } catch (error) {
      console.warn('Failed to open browser automatically:', error);
      // Continue execution - user can still open manually
    }

    try {
      const selection = await selectionPromise;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                message: 'Component selected',
                sessionId: session.id,
                galleryUrl,
                ...selection,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (waitError: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Component generation started but no selection was received: ${waitError?.message || 'unknown error'}. You can open the gallery at ${galleryUrl}`,
          },
        ],
      };
    }
  }

  private async handleSelectComponent(
    userId: string,
    args: any,
  ): Promise<{ content: any[] }> {
    const parsed = SelectComponentSchema.parse(args);

    const response = await this.apiClient.selectComponent(
      parsed.sessionId,
      parsed.componentId,
      userId,
    );

    // MCP content must be text/image items. Return a human-readable text payload.
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Component selected successfully',
              componentName: response.componentName,
              framework: response.framework,
              styling: response.styling,
              dependencies: response.dependencies || [],
              componentCode: response.componentCode,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleGetSessionStatus(
    userId: string,
    args: any,
  ): Promise<{ content: any[] }> {
    const parsed = GetSessionStatusSchema.parse(args);

    const session = await this.apiClient.getSession(parsed.sessionId);
    if (!session) {
      throw new SessionNotFoundError(parsed.sessionId);
    }

    // Check if user owns this session
    if (session.userId !== userId) {
      throw new AuthenticationError('Access denied to this session');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: session.id,
              status: session.status,
              completedComponents: session.sandboxResults.filter((r) => r.status === 'completed').length,
              totalComponents: session.sandboxResults.length,
              expiresAt: session.expiresAt,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  async connect(transport: any): Promise<void> {
    await this.server.connect(transport);
    console.log('Component Generation MCP Server connected');
  }

  async close(): Promise<void> {
    await this.server.close();
    console.log('Component Generation MCP Server closed');
  }

  private waitForSupabaseSelection(sessionId: string): Promise<any> {
    const timeoutMs = 60 * 60 * 1000; // 1 hour
    return new Promise((resolve, reject) => {
      let settled = false;
      const channel = this.supabase.channel(`session:${sessionId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'component_selected' }, ({ payload }: { payload: any }) => {
          if (settled) return;
          settled = true;
          resolve(payload);
          channel.unsubscribe();
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            // no-op
          }
        });

      setTimeout(() => {
        if (!settled) {
          settled = true;
          channel.unsubscribe();
          reject(new Error('Selection timed out'));
        }
      }, timeoutMs);
    });
  }
}
