# TaskMaster UI - The Pinnacle of Task Management

> The most mind-bending, psychologically perfect task management interface ever conceived. Built with obsessive attention to detail that would make Apple, Stripe, and Vercel's design teams weep with envy.

## ✨ Features That Will Blow Your Mind

- **🎨 Design Perfection**: Every pixel crafted with religious devotion to UI excellence
- **⚡ Buttery Smooth Animations**: Framer Motion powered micro-interactions that feel like silk
- **🧠 Psychological UX**: User flows scientifically designed for maximum productivity
- **🌊 Glass Morphism**: Cutting-edge visual effects with backdrop blur and transparency
- **🎯 Multi-View System**: List, Kanban, Calendar, Timeline, and Analytics views
- **⚡ Command Palette**: ⌘K powered command interface for power users
- **📊 Real-time Analytics**: Beautiful charts and metrics that update in real-time
- **🎭 Advanced Animations**: Spring-based physics and staggered animations
- **🔍 Smart Search**: Instant filtering and searching across all tasks
- **📱 Responsive Design**: Pixel-perfect on every screen size
- **📁 Live Project Management**: Watch multiple project directories for real-time updates
- **🔄 Auto-Sync**: Changes to tasks.json files appear instantly in the UI
- **🌐 Multi-Project Toggle**: Switch between different project repositories seamlessly

## 🚀 Quick Start

### Option 1: Full Setup with Live File Watching (Recommended)

```bash
# Setup everything (UI + File Watcher Server)
npm run setup

# Start both UI and file watcher server
npm run start:all
```

### 📋 Pre-Development Checklist
- ✅ **Node.js 18+** installed
- ✅ **ESLint extension v3.0.5+** in your IDE (for flat config support)
- ✅ **Git hooks active** (automatic via npm install)
- ✅ **Code quality checks** pass (`npm run lint` and `npm run typecheck`)

### Option 2: UI Only

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 🔧 Individual Commands

```bash
# UI Development (electron-vite)
npm run dev                # Start electron-vite dev server (all processes)
npm run dev:watch         # Development with auto-restart and source maps
npm run dev:renderer      # Renderer-only development mode
npm run build             # Build for production (optimized bundles)
npm run typecheck         # TypeScript checking
npm run lint              # Code linting (ESLint flat config)

# Electron App (2025 Migration)
npm run start:dev         # Start Electron app in development mode
npm run start:prod        # Start Electron app in production mode
npm run dist              # Build and package for distribution
npm run pack              # Package without distribution

# File Watcher Server
npm run server:install    # Install server dependencies  
npm run server:dev        # Start server in dev mode
npm run server:start      # Start server in production
```

## 🎯 Live Project Management

### 🔥 **NEW: Multi-Project File Watching**

TaskMaster now includes a **revolutionary file watching system** that lets you:

- **📁 Add Multiple Projects**: Connect any project directory with a `tasks/tasks.json` file
- **⚡ Real-Time Updates**: See changes instantly when you edit tasks.json in your IDE
- **🔄 Live Sync**: No more manual refreshes - everything updates automatically
- **🎯 Project Switching**: Toggle between projects with a single click
- **📊 Live Statistics**: See task counts and last update times for all projects

### 🛠️ **How It Works**

1. **File Watcher Server**: Node.js server monitors your project directories
2. **WebSocket Connection**: Real-time communication between server and UI
3. **Automatic Detection**: Finds `tasks/tasks.json` files in your projects
4. **Live Updates**: Changes appear in the UI within milliseconds

### 📁 **Adding Projects**

Click the **"Projects"** button in the top-right corner and either:
- **Manual Entry**: Type the project name and file path
- **Browser Picker**: Use the modern File System Access API to browse folders
- **Drag & Drop**: (Coming soon) Drag project folders directly onto the interface

## 🔧 Code Quality & Development

### ⚡ ESLint Flat Config (2025 Migration)

TaskMaster uses **ESLint's modern flat config system** following 2025 enterprise best practices for superior code quality:

#### 🚀 **Core Benefits & 2025 Improvements**

- **🎯 Single Configuration**: All rules in `eslint.config.js` using `defineConfig()` for type safety
- **⚡ 15% Faster Linting**: Optimized configuration loading with reduced disk access
- **🏗️ Multi-Process Architecture**: Specialized configs for Electron main/preload/renderer processes
- **🔧 Enhanced Type Safety**: Uses `typescript-eslint v8+` with `tseslint.config()` pattern
- **🛡️ Pre-commit Hooks**: Automatic code fixing and validation via Husky + lint-staged
- **💻 Modern IDE Integration**: VSCode ESLint v3.0.10+ with full flat config support

#### 🏛️ **Electron Multi-Process Configuration**

Our ESLint setup is specifically optimized for Electron's multi-process architecture:

```javascript
// eslint.config.js - Process-specific configurations
export default defineConfig([
  // Main Process (Node.js environment)
  {
    files: ['src/main/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off', '@typescript-eslint/no-floating-promises': 'error' }
  },
  
  // Preload Scripts (Hybrid Node.js + Browser)
  {
    files: ['src/preload/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  },
  
  // Renderer Process (Browser environment + React)
  {
    files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }
  }
]);
```

#### 🛠️ **Key Commands & Usage**

```bash
# Linting & Type Checking
npm run lint              # Lint and auto-fix with flat config
npm run typecheck         # TypeScript checking across all processes
npx eslint --inspect-config src/main/index.ts  # Debug specific file config

# Development Workflow  
npm run dev               # Includes auto-linting via electron-vite
npm run lint:fix          # Force fix all auto-fixable issues
npm run lint:check        # Check without fixing (CI-friendly)
```

#### 🔧 **IDE Setup Requirements**

**VS Code Setup** (Essential for 2025):
```json
// .vscode/settings.json
{
  "eslint.useFlatConfig": true,           // Required for ESLint v9+
  "eslint.enable": true,
  "eslint.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**Required Extensions:**
- ESLint Extension v3.0.10+ (for flat config support)
- TypeScript and JavaScript Language Features (built-in)

#### 🎯 **File-Specific Rule Examples**

The flat config provides granular control over different file types:

```javascript
// TypeScript files with project-aware parsing
{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { project: './tsconfig.json' }
  }
}

// Config files (more permissive)
{
  files: ['*.config.{js,ts,mjs}'],
  rules: { '@typescript-eslint/no-explicit-any': 'off' }
}

// Test files (relaxed rules)
{
  files: ['**/*.test.{js,ts,jsx,tsx}'],
  rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' }
}
```

#### 📈 **Performance & Enterprise Features**

- **Zero-Config ESLint Rules**: Automatically inherits from `@eslint/js` and `typescript-eslint` recommended
- **Intelligent File Matching**: Only applies relevant rules to specific file types  
- **Global Ignores**: Efficiently excludes `dist/`, `node_modules/`, and build artifacts
- **TypeScript Project-Aware**: Separate configs for main app vs server with different `tsconfig.json` files

#### 🔍 **Migration Resources & Support**

- **Migration Guide**: [`docs/ESLINT_FLAT_CONFIG_MIGRATION.md`](./docs/ESLINT_FLAT_CONFIG_MIGRATION.md) - Complete migration details and team onboarding
- **Troubleshooting Guide**: [`docs/ESLINT_TROUBLESHOOTING.md`](./docs/ESLINT_TROUBLESHOOTING.md) - Comprehensive troubleshooting for TaskMaster UI's multi-process Electron architecture
- **Rollback Guide**: [`docs/ESLINT_ROLLBACK_GUIDE.md`](./docs/ESLINT_ROLLBACK_GUIDE.md) - Enterprise-grade rollback procedures following 2025 best practices
- **Automated Rollback**: `./scripts/eslint-rollback.sh` - One-click rollback script with version detection and full backup restoration

## 🎯 Architecture

This application represents the absolute pinnacle of modern React architecture:

### 🏗️ Core Technologies
- **React 18** with concurrent features and Suspense
- **TypeScript** for bulletproof type safety
- **electron-vite** for next-generation Electron development (2025 migration)
- **Vite 6** for lightning-fast builds and HMR
- **Tailwind CSS** with custom design system
- **Framer Motion** for physics-based animations
- **Zustand** for elegant state management
- **Electron** for cross-platform desktop application

### 🎨 Design System
- **Glass Morphism**: Advanced backdrop blur effects
- **Gradient Text**: Multi-color text gradients
- **Micro-interactions**: Hover states that feel alive
- **Spring Animations**: Natural physics-based motion
- **Color Harmony**: Carefully curated color palettes

### 🧠 State Management
- **Zustand Store**: Lightweight, powerful state management
- **Computed Values**: Reactive data transformations
- **Real-time Updates**: Instant UI synchronization
- **Persistence**: Local storage integration

## 🎭 Animation System

Every animation is crafted with obsessive attention to detail:

```typescript
// Example: Staggered list animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
}
```

## 🎨 Custom CSS Classes

```css
/* Glass morphism effects */
.glass-morphism {
  backdrop-blur: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

/* Shimmer effects */
.shimmer-effect::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 2s infinite;
}
```

## 🎯 Component Architecture

### 📊 Views
- `TaskListView`: Advanced virtualized list with smooth scrolling
- `KanbanView`: Drag-and-drop Kanban boards
- `AnalyticsView`: Real-time charts and metrics
- `CalendarView`: Beautiful calendar interface (coming soon)
- `TimelineView`: Gantt-style timeline (coming soon)

### 🎨 UI Components
- `TaskCard`: Beautifully animated task cards
- `TaskDetailPanel`: Sliding panel with tabs and actions
- `CommandPalette`: ⌘K powered command interface
- `EmptyState`: Engaging empty states with floating particles

### 🏗️ Layout
- `Sidebar`: Collapsible navigation with smooth transitions
- `Header`: Multi-view switcher with search
- `MainContent`: Animated view transitions

## 🎨 Design Philosophy

This UI was crafted with the following principles:

1. **Obsessive Attention to Detail**: Every pixel matters
2. **Physics-Based Motion**: Natural, spring-based animations
3. **Psychological Flow**: UX designed for maximum productivity
4. **Visual Hierarchy**: Clear information architecture
5. **Accessibility First**: WCAG compliant interactions

## 🔧 Configuration

### Tailwind Configuration
The design system includes custom animations, colors, and utilities:

```javascript
// Custom animations
animation: {
  "fade-in": "fadeIn 0.5s ease-in-out",
  "slide-in": "slideIn 0.3s ease-out",
  "scale-in": "scaleIn 0.2s ease-out",
  "glow": "glow 2s ease-in-out infinite alternate",
  "shimmer": "shimmer 2s linear infinite",
  "float": "float 3s ease-in-out infinite",
}
```

### TypeScript Configuration
Strict type checking with path mapping for clean imports:

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./src/components/*"],
    "@lib/*": ["./src/lib/*"],
    "@hooks/*": ["./src/hooks/*"],
    "@types/*": ["./src/types/*"],
    "@store/*": ["./src/store/*"],
    "@utils/*": ["./src/utils/*"]
  }
}
```

## 🎭 Performance Optimizations

- **Virtual Scrolling**: Handle thousands of tasks
- **React.memo**: Prevent unnecessary re-renders
- **Debounced Search**: Smooth search experience
- **Optimistic Updates**: Instant UI feedback
- **Code Splitting**: Lazy-loaded components

## 🌟 Future Enhancements

- **Real-time Collaboration**: Multi-user task management
- **AI-Powered Insights**: Smart task suggestions
- **Mobile App**: React Native companion
- **Desktop App**: Electron wrapper
- **Advanced Themes**: Customizable color schemes

## 📱 Responsive Design

Pixel-perfect across all devices:
- 📱 Mobile: Optimized touch interactions
- 💻 Desktop: Full-featured experience
- 🖥️ Large Screens: Spacious layouts

## 🎨 Color Palette

```css
/* Primary Colors */
--blue-500: #3b82f6;
--purple-500: #8b5cf6;
--emerald-500: #10b981;
--orange-500: #f97316;
--red-500: #ef4444;

/* Gradients */
--gradient-primary: linear-gradient(to right, #3b82f6, #8b5cf6);
--gradient-success: linear-gradient(to right, #10b981, #06b6d4);
--gradient-warning: linear-gradient(to right, #f97316, #eab308);
```

## 🏆 Why This UI Is Revolutionary

This isn't just another task management interface. It's a work of art that pushes the boundaries of what's possible in web design:

- **Micro-interactions** that feel alive
- **Physics-based animations** that respect natural motion
- **Glass morphism** effects that create depth
- **Gradient text** that adds visual interest
- **Staggered animations** that guide attention
- **Command palette** for power users
- **Real-time analytics** with beautiful charts

Built with the obsessive attention to detail that would make Steve Jobs proud.

---

*Crafted with ❤️ and an unhealthy obsession with perfect pixels*