import { createFinalAction, FinalActionTypes } from "./action.js";
import { AgentMemory } from "./memory.js";
import { resolveCapabilityProfile } from "./profile.js";
import { PromptBuilder } from "./prompt/builder.js";
import { createAgentTrace } from "./trace.js";
import { createTrigger } from "./trigger.js";

function isRetryableRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("429") || message.includes("rate_limit") || message.includes("too many requests");
}

export class Agent {
  constructor({
    identity,
    personaPrompt = "",
    worldPrompt = "",
    capabilityProfile = null,
    memory = new AgentMemory(),
    llm,
    tools,
    promptBuilder = new PromptBuilder(),
    hooks = {}
  }) {
    if (!identity?.id) {
      throw new Error("Agent requires a valid identity.");
    }

    if (!llm || typeof llm.respond !== "function") {
      throw new Error("Agent requires an llm adapter with respond().");
    }

    if (!tools || typeof tools.buildExecutionTools !== "function") {
      throw new Error("Agent requires a tool registry.");
    }

    this.identity = identity;
    this.personaPrompt = personaPrompt;
    this.worldPrompt = worldPrompt;
    this.capabilityProfile = resolveCapabilityProfile(
      capabilityProfile || this.identity?.metadata?.capabilityProfile || {}
    );
    this.memory = memory;
    this.llm = llm;
    this.tools = tools;
    this.promptBuilder = promptBuilder;
    this.hooks = {
      beforePrompt: hooks.beforePrompt || null,
      beforeRespond: hooks.beforeRespond || null,
      afterRespond: hooks.afterRespond || null,
      onError: hooks.onError || null
    };
  }

  createTrace(trigger) {
    return createAgentTrace({
      agent: this,
      trigger
    });
  }

  buildExecutionTools({ trace, trigger }) {
    return this.tools.buildExecutionTools({
      trace,
      agentId: this.identity.id,
      trigger
    });
  }

  buildPrompt({ trigger, executionTools, trace }) {
    const prompt = this.promptBuilder.build({
      identity: this.identity,
      capabilityProfile: this.capabilityProfile,
      personaPrompt: this.personaPrompt,
      worldPrompt: this.worldPrompt,
      memory: this.memory,
      trigger,
      tools: executionTools
    });

    if (typeof this.hooks.beforePrompt === "function") {
      return this.hooks.beforePrompt({
        agent: this,
        trigger,
        prompt,
        trace,
        tools: executionTools
      }) || prompt;
    }

    return prompt;
  }

  async invokeModel({ prompt, trigger, executionTools, trace }) {
    if (typeof this.hooks.beforeRespond === "function") {
      await this.hooks.beforeRespond({
        agent: this,
        trigger,
        prompt,
        trace,
        tools: executionTools
      });
    }

    const modelResult = await this.llm.respond({
      identity: this.identity,
      prompt,
      trigger,
      memory: this.memory.snapshot(),
      tools: executionTools
    });

    if (typeof this.hooks.afterRespond === "function") {
      await this.hooks.afterRespond({
        agent: this,
        trigger,
        prompt,
        trace,
        tools: executionTools,
        modelResult
      });
    }

    return modelResult;
  }

  async handleTrigger(triggerSpec) {
    const trigger = createTrigger(triggerSpec);
    const trace = this.createTrace(trigger);

    trace.memoryBefore = this.memory.snapshot();
    const executionTools = this.buildExecutionTools({ trace, trigger });
    const prompt = this.buildPrompt({ trigger, executionTools, trace });

    trace.prompt = prompt;
    try {
      const modelResult = await this.invokeModel({
        prompt,
        trigger,
        executionTools,
        trace
      });

      const finalAction = createFinalAction(
        modelResult?.finalAction || {
          type: FinalActionTypes.PASS,
          reason: "The model did not return a final action. Defaulting to pass."
        }
      );

      trace.modelResult = {
        rawText: modelResult?.rawText || "",
        usage: modelResult?.usage || {},
        provider: modelResult?.provider || "",
        model: modelResult?.model || ""
      };
      trace.finalAction = finalAction;
      trace.memoryAfter = this.memory.snapshot();
      trace.finishedAt = Date.now();

      return {
        action: finalAction,
        trace
      };
    } catch (error) {
      trace.modelResult = {
        rawText: "",
        usage: {},
        error: error.message || String(error)
      };
      trace.memoryAfter = this.memory.snapshot();
      trace.finishedAt = Date.now();

      if (isRetryableRateLimitError(error)) {
        trace.metadata = {
          ...(trace.metadata || {}),
          transientError: true,
          errorKind: "rate_limit"
        };
        error.trace = trace;
        error.retryable = true;
        throw error;
      }

      trace.finalAction = createFinalAction({
        type: FinalActionTypes.PASS,
        reason: `agent_error: ${error.message || String(error)}`
      });

      if (typeof this.hooks.onError === "function") {
        await this.hooks.onError({
          agent: this,
          trigger,
          prompt,
          trace,
          error
        });
      }

      return {
        action: trace.finalAction,
        trace
      };
    }
  }
}
