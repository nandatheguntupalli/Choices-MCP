# Adorable Component Generator MCP

An MCP (Model Context Protocol) server for generating React UI components with AI-powered gallery selection. Generate 5 different styled variations of any component and select your favorite through an interactive web gallery.

## Features

- ✨ **5 Enhanced Design Systems**: Production-grade styling with sophisticated color palettes and patterns
- ⚛️ **React Components**: Generate production-ready React/Next.js components with TypeScript
- 🎯 **Advanced Tailwind**: Enhanced styling with custom design tokens and animation patterns
- 🌐 **Interactive Gallery**: Web-based component preview and selection with live previews
- 🤖 **AI-Powered**: Uses Claude with sophisticated design prompts for professional results
- 📦 **Auto-Dependencies**: Smart dependency management with performance optimization
- 🎨 **Professional Aesthetics**: Corporate-grade visual design following modern UI/UX principles
- 🚀 **Performance Optimized**: Built with accessibility, responsiveness, and speed in mind

## Installation

### Global Installation (Recommended)

```bash
npm install -g adorable-component-generator-mcp
```

### NPX Usage (No Installation)

```bash
npx adorable-component-generator-mcp
```

## Setup

### 1. Get an API Key

First, you need an API key from the Adorable Component Generator service. Contact the service provider or visit the dashboard to get your key.

### 2. Set Environment Variables

Create a `.env` file or set environment variables:

```bash
export ADORABLE_API_KEY="your-api-key-here"
export ADORABLE_BASE_URL="https://your-service-url.com"  # Optional, defaults to localhost:3000
```

### 3. Configure with Claude Desktop

Add this to your Claude Desktop configuration (`~/.config/claude/config.json` or similar):

```json
{
  "mcpServers": {
    "adorable-component-generator": {
      "command": "npx",
      "args": ["adorable-component-generator-mcp"],
      "env": {
        "ADORABLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. Configure with Cursor

In Cursor, add this to your MCP configuration:

```json
{
  "adorable-component-generator": {
    "command": "npx adorable-component-generator-mcp",
    "env": {
      "ADORABLE_API_KEY": "your-api-key-here"
    }
  }
}
```

## Usage

### With Claude Desktop or Cursor

Once configured, you can use the component generator directly in your AI conversations:

```
Generate a pricing card component for my SaaS product
```

```
Create a login form with email and password fields
```

```
Build a hero section with a call-to-action button
```

### Manual Usage

You can also run the MCP server directly:

```bash
# With global installation
adorable-mcp

# With npx
npx adorable-component-generator-mcp
```

## How It Works

1. **Component Request**: Ask Claude to generate a component with a description
2. **AI Generation**: The service creates 5 styled variations using AI
3. **Gallery Opens**: An interactive web gallery opens in your browser
4. **Preview & Select**: Preview each variation and select your favorite
5. **Code Delivery**: The selected component code is returned to Claude/Cursor
6. **Implementation**: Copy the code into your project and customize as needed

## Enhanced Design Systems

Each request generates 5 sophisticated variations:

### 🔷 Modern SaaS Professional
Clean architecture with sophisticated blues, elegant spacing, and subtle depth. Perfect for B2B products and professional dashboards. Features enterprise-grade visual hierarchy with advanced interaction states.

### ⚡ Neon Signal Flow  
Electric cyberpunk aesthetics with glowing accents, dark surfaces, and dynamic gradients. Ideal for tech products and gaming interfaces. Includes custom neon glow effects and electric color schemes.

### 🏢 Enterprise Minimalist
Refined corporate design with neutral palettes, perfect typography, and executive-level polish. Built for enterprise applications with maximum professionalism and clarity.

### 🎨 Creative Studio Vibrant
Bold artistic expression with vibrant colors, playful interactions, and creative energy. Perfect for design agencies and creative tools. Features rainbow gradients and artistic layouts.

### ⚪ Pure Functional Design
Ultra-minimal aesthetic focusing on perfect functionality, crystal clarity, and zero visual noise. Ideal for productivity tools with mathematical precision in spacing and typography.

## Requirements

- Node.js 18.0.0 or higher
- Valid ADORABLE_API_KEY
- Modern web browser (for gallery selection)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADORABLE_API_KEY` | Yes | - | Your API key for the service |
| `ADORABLE_BASE_URL` | No | `http://localhost:3000` | Base URL of the Adorable service |

## Troubleshooting

### "ADORABLE_API_KEY environment variable is required"
Set the `ADORABLE_API_KEY` environment variable with your API key.

### "API call failed: 401"
Check that your API key is valid and has not expired.

### "Gallery doesn't open"
Make sure you have a default web browser set and that the service URL is accessible.

### "No component selected within 5 minutes"
The selection process times out after 5 minutes. Make sure to select a component in the gallery within this time.

## Development

### Local Development

```bash
git clone https://github.com/Operative-Sh/Choices-MCP.git
cd Choices-MCP/mcp-server
npm install
npm run build
npm run dev
```

### Testing

```bash
npm test
```

### Publishing

```bash
npm version patch  # or minor/major
npm publish
```

## License

MIT

## Support

For support, please visit [GitHub Issues](https://github.com/Operative-Sh/Choices-MCP/issues) or contact the service provider.