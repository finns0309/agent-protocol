function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool || typeof tool !== "object") {
      throw new Error("tool must be an object.");
    }

    if (typeof tool.name !== "string" || tool.name.length === 0) {
      throw new Error("tool.name must be a non-empty string.");
    }

    if (typeof tool.handler !== "function") {
      throw new Error(`tool ${tool.name} must provide a handler function.`);
    }

    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description || "",
      inputSchema: clone(tool.inputSchema || {}),
      handler: tool.handler
    });
    return this;
  }

  list() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: clone(tool.inputSchema)
    }));
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  buildExecutionTools({ trace, agentId, trigger }) {
    return this.list().map((toolInfo) => ({
      ...toolInfo,
      execute: async (input = {}) => {
        const tool = this.get(toolInfo.name);
        const startedAt = Date.now();
        let result;
        let error = null;

        try {
          result = await tool.handler({
            agentId,
            trigger,
            input: clone(input)
          });
        } catch (handlerError) {
          error = handlerError;
          throw handlerError;
        } finally {
          trace.toolCalls.push({
            tool: toolInfo.name,
            input: clone(input),
            output: error ? { error: error.message || String(error) } : clone(result),
            startedAt,
            finishedAt: Date.now()
          });
        }

        return clone(result);
      }
    }));
  }
}
