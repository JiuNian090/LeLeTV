---
name: codegraph-cli
description: CLI wrapper for CodeGraph semantic code intelligence. Use for code exploration, context building, and dependency analysis.
license: MIT
version: 0.9.6
---

## CodeGraph CLI Usage

### Installation
```bash
npm install -g @colbymchenry/codegraph
```

### Basic Commands

#### Initialize project
```bash
codegraph init
```
- `-i, --index`: Run initial indexing after initialization
- `-v, --verbose`: Show detailed worker lifecycle and memory info

#### Show file structure
```bash
codegraph files [path] --format tree --max-depth 3
```

#### Build context for AI
```bash
codegraph context "implement OAuth login" --max-nodes 50
```

#### Find affected test files
```bash
codegraph affected src/auth/*.ts
```

#### Search codebase
```bash
codegraph search "validateToken"
```

#### Show status
```bash
codegraph status
```

#### Update index
```bash
codegraph update
```

#### Clear cache
```bash
codegraph clear
```

#### Serve MCP
```bash
codegraph serve --mcp
```

### Benefits
- **Faster Exploration**: Pre-indexed knowledge graph reduces tool calls
- **Better Context**: AI gets structured code knowledge without scanning files
- **Reduced Token Cost**: Less file reading, more direct queries
- **Real-time Sync**: Auto-updates when files change

### Use Cases
- **Code Exploration**: Understand unfamiliar codebases quickly
- **Refactoring**: Get complete dependency picture before making changes
- **Impact Analysis**: Find affected tests and modules
- **Context Building**: Provide AI with relevant code context