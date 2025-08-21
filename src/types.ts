// Component generation session types
export interface ComponentGenerationSession {
  id: string;
  userId: string;
  description: string;
  framework: 'react' | 'vue' | 'angular';
  styling: 'tailwind' | 'css' | 'styled-components';
  createdAt: Date;
  status: 'pending' | 'generating' | 'completed' | 'selected' | 'expired';
  sandboxResults: SandboxResult[];
  selectedComponentId?: string;
  expiresAt: Date;
}

export interface SandboxResult {
  id: string;
  sessionId: string;
  sandboxIndex: number;
  component: GeneratedComponent;
  status: 'generating' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedComponent {
  name: string;
  code: string;
  framework: string;
  styling: string;
  description: string;
  preview?: string;
  dependencies?: string[];
}

export interface ComponentSelectionEvent {
  sessionId: string;
  componentId: string;
  userId: string;
  timestamp: Date;
}

// WebSocket message types
export interface WSMessage {
  type: 'session_created' | 'sandbox_completed' | 'component_selected' | 'error';
  sessionId: string;
  data: any;
}

// MCP Tool request/response types
export interface ComponentGenerationRequest {
  description: string;
  framework?: 'react' | 'vue' | 'angular';
  styling?: 'tailwind' | 'css' | 'styled-components';
}

export interface ComponentGenerationResponse {
  sessionId: string;
  galleryUrl: string;
  status: 'created';
}

export interface ComponentSelectionResponse {
  componentCode: string;
  componentName: string;
  framework: string;
  styling: string;
  dependencies?: string[];
}

// Authentication types
export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

export interface AdorableApiClient {
  validateApiKey(apiKey: string): Promise<ApiKeyValidationResult>;
  createSession(userId: string, request: ComponentGenerationRequest): Promise<ComponentGenerationSession>;
  getSession(sessionId: string): Promise<ComponentGenerationSession | null>;
  updateSession(sessionId: string, updates: Partial<ComponentGenerationSession>): Promise<void>;
  selectComponent(sessionId: string, componentId: string, userId: string): Promise<ComponentSelectionResponse>;
}

// Error types
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class ComponentNotFoundError extends Error {
  constructor(componentId: string) {
    super(`Component not found: ${componentId}`);
    this.name = 'ComponentNotFoundError';
  }
}

export class SessionExpiredError extends Error {
  constructor(sessionId: string) {
    super(`Session expired: ${sessionId}`);
    this.name = 'SessionExpiredError';
  }
}
