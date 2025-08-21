import { AdorableApiClient } from './adorable-auth.js';
import { ComponentGenerationRequest } from '../types.js';

export interface VariationRequest {
  description: string;
  framework: 'react' | 'vue' | 'angular';
  styling: 'tailwind' | 'css' | 'styled-components';
}

export class FreestyleOrchestrator {
  private apiClient: AdorableApiClient;

  constructor() {
    this.apiClient = new AdorableApiClient();
  }

  /**
   * Generate 5 different variations of the same component type in parallel
   */
  async generateVariations(sessionId: string, request: VariationRequest): Promise<void> {
    console.log(`Starting generation of 5 variations for session ${sessionId}`);
    
    // Create 5 different prompts for variations of the same component
    const variations = this.createVariationPrompts(request);
    
    // Start all 5 sandbox generations in parallel
    const promises = variations.map((variation, index) => 
      this.generateSingleVariation(sessionId, index, variation)
    );
    
    // Wait for all to complete (but don't block if some fail)
    await Promise.allSettled(promises);
    
    console.log(`Completed generation process for session ${sessionId}`);
  }

  /**
   * Create 5 different prompts for variations of the same component type
   */
  private createVariationPrompts(request: VariationRequest): string[] {
    const baseDescription = request.description.toLowerCase();
    const framework = request.framework;
    const styling = request.styling;
    
    // Create 5 different style variations of the same component
    const variations = [
      // Variation 1: Modern/Minimal
      `Create a modern, minimal ${baseDescription} component in ${framework} with ${styling}. 
       Use clean lines, subtle shadows, and a professional color scheme. Focus on simplicity and elegance.`,
      
      // Variation 2: Colorful/Creative
      `Create a colorful, creative ${baseDescription} component in ${framework} with ${styling}. 
       Use vibrant colors, gradients, and playful design elements. Make it visually striking and engaging.`,
      
      // Variation 3: Corporate/Professional
      `Create a corporate, professional ${baseDescription} component in ${framework} with ${styling}. 
       Use neutral colors, clear typography, and a business-oriented design. Emphasize trust and reliability.`,
      
      // Variation 4: Dark Theme
      `Create a dark-themed ${baseDescription} component in ${framework} with ${styling}. 
       Use dark backgrounds with light text, subtle glows, and modern contrast. Make it easy on the eyes.`,
      
      // Variation 5: Animated/Interactive
      `Create an animated, interactive ${baseDescription} component in ${framework} with ${styling}. 
       Include hover effects, smooth transitions, and subtle animations. Make it feel responsive and dynamic.`
    ];
    
    return variations;
  }

  /**
   * Generate a single component variation
   */
  private async generateSingleVariation(
    sessionId: string, 
    variationIndex: number, 
    prompt: string
  ): Promise<void> {
    let sandboxResultId: string | null = null;
    
    try {
      console.log(`Starting variation ${variationIndex + 1} for session ${sessionId}`);
      
      // Create sandbox result entry in database
      sandboxResultId = await this.apiClient.createSandboxResult(sessionId, variationIndex);
      
      // Broadcast sandbox start (real-time update)
      await this.broadcastSandboxStarted(sessionId, variationIndex, sandboxResultId);
      
      // Generate component using Freestyle (mock implementation for now)
      const result = await this.mockFreestyleGeneration(prompt, variationIndex);
      
      if (result.success && result.component) {
        // Update sandbox result with successful generation
        await this.apiClient.updateSandboxResult(sandboxResultId, {
          name: result.component.name || `Component ${variationIndex + 1}`,
          code: result.component.code,
          description: result.component.description || prompt,
          preview: result.component.preview,
          dependencies: result.component.dependencies,
        });
        
        // Broadcast successful completion (real-time update)
        await this.broadcastSandboxCompleted(sessionId, variationIndex, {
          id: sandboxResultId,
          name: result.component.name,
          status: 'completed'
        });
        
        console.log(`Completed variation ${variationIndex + 1} for session ${sessionId}`);
      } else {
        // Handle generation failure
        await this.apiClient.updateSandboxResult(sandboxResultId, {
          name: `Failed Component ${variationIndex + 1}`,
          code: '',
          description: prompt,
          error: result.error || 'Unknown generation error',
        });
        
        // Broadcast failure (real-time update)
        await this.broadcastSandboxFailed(sessionId, variationIndex, result.error || 'Unknown generation error');
        
        console.error(`Failed variation ${variationIndex + 1} for session ${sessionId}:`, result.error);
      }
      
    } catch (error: any) {
      console.error(`Error in variation ${variationIndex + 1} for session ${sessionId}:`, error);
      
      // Update sandbox result with error if we have an ID
      if (sandboxResultId) {
        try {
          await this.apiClient.updateSandboxResult(sandboxResultId, {
            name: `Error Component ${variationIndex + 1}`,
            code: '',
            description: prompt,
            error: error.message || 'Unknown error during generation',
          });
          
          // Broadcast failure (real-time update)
          await this.broadcastSandboxFailed(sessionId, variationIndex, error.message || 'Unknown error during generation');
        } catch (updateError) {
          console.error('Failed to update sandbox result with error:', updateError);
        }
      }
    }
  }

  /**
   * Mock freestyle generation for development/testing
   * TODO: Replace with actual Freestyle API integration
   */
  private async mockFreestyleGeneration(prompt: string, variationIndex: number): Promise<{
    success: boolean;
    component?: {
      name: string;
      code: string;
      description: string;
      preview?: string;
      dependencies?: string[];
    };
    error?: string;
  }> {
    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      return {
        success: false,
        error: 'Mock generation failed for testing purposes'
      };
    }

    const componentTypes = ['Modern', 'Colorful', 'Corporate', 'Dark Theme', 'Animated'];
    const componentType = componentTypes[variationIndex] || `Variation ${variationIndex + 1}`;
    
    const mockCode = `import React from 'react';

export default function ${componentType.replace(/\s+/g, '')}Component() {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">${componentType} Component</h2>
      <p className="text-gray-600">${prompt}</p>
      {/* ${componentType} styling and content */}
    </div>
  );
}`;

    return {
      success: true,
      component: {
        name: `${componentType} Component`,
        code: mockCode,
        description: `A ${componentType.toLowerCase()} implementation of: ${prompt}`,
        dependencies: ['react', 'tailwindcss'],
      }
    };
  }

  /**
   * Broadcast functions to communicate with Adorable app's real-time system
   * These use the AdorableApiClient's public broadcasting methods
   */
  private async broadcastSandboxStarted(sessionId: string, sandboxIndex: number, sandboxId: string): Promise<void> {
    await this.apiClient.broadcastSandboxStarted(sessionId, sandboxIndex, sandboxId);
  }

  private async broadcastSandboxCompleted(sessionId: string, sandboxIndex: number, sandboxResult: any): Promise<void> {
    await this.apiClient.broadcastSandboxCompleted(sessionId, sandboxIndex, sandboxResult);
  }

  private async broadcastSandboxFailed(sessionId: string, sandboxIndex: number, error: string): Promise<void> {
    await this.apiClient.broadcastSandboxFailed(sessionId, sandboxIndex, error);
  }

  /**
   * Generate a preview image for a component (if supported by Freestyle)
   */
  private async generatePreview(componentCode: string): Promise<string | undefined> {
    try {
      // This would depend on Freestyle API capabilities
      // For now, return undefined - preview generation can be added later
      return undefined;
    } catch (error) {
      console.error('Preview generation failed:', error);
      return undefined;
    }
  }

  /**
   * Extract dependencies from component code
   */
  private extractDependencies(componentCode: string, framework: string): string[] {
    const dependencies: string[] = [];
    
    try {
      // Basic dependency extraction based on import statements
      const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(componentCode)) !== null) {
        const importPath = match[1];
        
        // Skip relative imports (they're not external dependencies)
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          // Extract package name (everything before the first slash for scoped packages)
          const packageName = importPath.startsWith('@') 
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];
            
          if (packageName && !dependencies.includes(packageName)) {
            dependencies.push(packageName);
          }
        }
      }
      
      // Add framework-specific common dependencies if not already present
      if (framework === 'react') {
        if (!dependencies.includes('react')) dependencies.push('react');
        if (componentCode.includes('useState') || componentCode.includes('useEffect')) {
          // React hooks are part of react, no additional dependency needed
        }
      }
      
    } catch (error) {
      console.error('Dependency extraction failed:', error);
    }
    
    return dependencies;
  }
}
