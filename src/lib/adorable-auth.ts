import axios, { AxiosInstance } from 'axios';
import {
  ApiKeyValidationResult,
  ComponentGenerationRequest,
  ComponentGenerationSession,
  ComponentSelectionResponse,
  AuthenticationError,
  SessionNotFoundError,
  ComponentNotFoundError,
  SessionExpiredError,
} from '../types.js';

export class AdorableApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.ADORABLE_BASE_URL || 'http://localhost:3000';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Validate API key against Adorable app's authentication system
   */
  async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    try {
      const response = await this.client.post('/api/mcp/validate', {
        apiKey,
      });

      if (response.status === 200 && response.data.valid) {
        return {
          valid: true,
          userId: response.data.userId,
        };
      } else {
        return {
          valid: false,
          error: response.data.error || 'Invalid API key',
        };
      }
    } catch (error: any) {
      console.error('API key validation failed:', error);
      return {
        valid: false,
        error: error.response?.data?.error || error.message || 'Authentication failed',
      };
    }
  }

  /**
   * Create a new component generation session and start generation
   */
  async createSession(
    userId: string,
    request: ComponentGenerationRequest,
  ): Promise<ComponentGenerationSession> {
    try {
      const response = await this.client.post('/api/gallery/generate', {
        description: request.description,
        framework: request.framework || 'react',
        styling: request.styling || 'tailwind',
      }, {
        headers: {
          'x-api-key': process.env.ADORABLE_API_KEY,
        },
      });

      if (response.status === 201) {
        // The /api/gallery/generate endpoint returns a different format
        // We need to fetch the full session data
        const sessionId = response.data.sessionId;
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          return sessionData;
        } else {
          throw new Error('Failed to retrieve created session');
        }
      } else {
        throw new Error(`Failed to create session: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('Session creation failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to create session',
      );
    }
  }

  /**
   * Get an existing component generation session
   */
  async getSession(sessionId: string): Promise<ComponentGenerationSession | null> {
    try {
      const response = await this.client.get(`/api/gallery/sessions/${sessionId}`);

      if (response.status === 200) {
        return this.mapSessionResponse(response.data);
      } else if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get session: ${response.data.error}`);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Session retrieval failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to get session',
      );
    }
  }

  /**
   * Update session status and data
   */
  async updateSession(
    sessionId: string,
    updates: Partial<ComponentGenerationSession>,
  ): Promise<void> {
    try {
      const response = await this.client.patch(`/api/gallery/sessions/${sessionId}`, updates);

      if (response.status !== 200) {
        throw new Error(`Failed to update session: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('Session update failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to update session',
      );
    }
  }

  /**
   * Select a component and return its code snippet
   */
  async selectComponent(
    sessionId: string,
    componentId: string,
    userId: string,
  ): Promise<ComponentSelectionResponse> {
    try {
      const response = await this.client.post(
        `/api/gallery/sessions/${sessionId}/select`,
        {
          componentId,
          userId,
        },
      );

      if (response.status === 200) {
        return response.data;
      } else {
        const errorData = response.data;
        if (response.status === 404) {
          if (errorData.error?.includes('session')) {
            throw new SessionNotFoundError(sessionId);
          } else {
            throw new ComponentNotFoundError(componentId);
          }
        } else if (response.status === 410) {
          throw new SessionExpiredError(sessionId);
        } else {
          throw new Error(errorData.error || 'Failed to select component');
        }
      }
    } catch (error: any) {
      if (
        error instanceof SessionNotFoundError ||
        error instanceof ComponentNotFoundError ||
        error instanceof SessionExpiredError
      ) {
        throw error;
      }

      console.error('Component selection failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to select component',
      );
    }
  }

  /**
   * Create sandbox result entry
   */
  async createSandboxResult(sessionId: string, sandboxIndex: number): Promise<string> {
    try {
      const response = await this.client.post(`/api/gallery/sessions/${sessionId}/sandbox`, {
        sandboxIndex,
      });

      if (response.status === 201) {
        return response.data.id;
      } else {
        throw new Error(`Failed to create sandbox result: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('Sandbox result creation failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to create sandbox result',
      );
    }
  }

  /**
   * Update sandbox result with generated component
   */
  async updateSandboxResult(
    sandboxResultId: string,
    component: {
      name: string;
      code: string;
      description: string;
      preview?: string;
      dependencies?: string[];
      error?: string;
    },
  ): Promise<void> {
    try {
      const response = await this.client.patch(`/api/gallery/sandbox/${sandboxResultId}`, {
        status: component.error ? 'failed' : 'completed',
        componentName: component.name,
        componentCode: component.code,
        componentDescription: component.description,
        preview: component.preview,
        dependencies: component.dependencies,
        error: component.error,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to update sandbox result: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('Sandbox result update failed:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to update sandbox result',
      );
    }
  }

  /**
   * Broadcasting methods for real-time updates
   */
  async broadcastSandboxStarted(sessionId: string, sandboxIndex: number, sandboxId: string): Promise<void> {
    try {
      await this.client.post('/api/gallery/broadcast/sandbox-started', {
        sessionId,
        sandboxIndex,
        sandboxId
      });
    } catch (error) {
      console.error('Failed to broadcast sandbox started:', error);
    }
  }

  async broadcastSandboxCompleted(sessionId: string, sandboxIndex: number, sandboxResult: any): Promise<void> {
    try {
      await this.client.post('/api/gallery/broadcast/sandbox-completed', {
        sessionId,
        sandboxIndex,
        sandboxResult
      });
    } catch (error) {
      console.error('Failed to broadcast sandbox completed:', error);
    }
  }

  async broadcastSandboxFailed(sessionId: string, sandboxIndex: number, error: string): Promise<void> {
    try {
      await this.client.post('/api/gallery/broadcast/sandbox-failed', {
        sessionId,
        sandboxIndex,
        error
      });
    } catch (error) {
      console.error('Failed to broadcast sandbox failed:', error);
    }
  }

  /**
   * Map API response to ComponentGenerationSession interface
   */
  private mapSessionResponse(data: any): ComponentGenerationSession {
    return {
      id: data.id,
      userId: data.userId,
      description: data.description,
      framework: data.framework,
      styling: data.styling,
      status: data.status,
      selectedComponentId: data.selectedComponentId,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
      sandboxResults: (data.sandboxResults || []).map((result: any) => ({
        id: result.id,
        sessionId: result.sessionId,
        sandboxIndex: result.sandboxIndex,
        status: result.status,
        component: {
          name: result.componentName || '',
          code: result.componentCode || '',
          framework: data.framework,
          styling: data.styling,
          description: result.componentDescription || '',
          preview: result.preview,
          dependencies: result.dependencies || [],
        },
        error: result.error,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt),
      })),
    };
  }
}
