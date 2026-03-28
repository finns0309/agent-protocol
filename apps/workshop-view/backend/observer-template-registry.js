import path from "node:path";
import process from "node:process";

const DEFAULT_TEMPLATES = [
  {
    id: "chat",
    name: "Chat View",
    description: "Conversation-first observer, best for watching the full request / offer / route / deliver arc.",
    focus: "conversation",
    scriptPath: path.resolve(process.cwd(), "apps/chat-view/server.js"),
    envPortKey: "CHAT_VIEW_PORT"
  },
  {
    id: "ops",
    name: "Ops View",
    description: "Operations-first observer, focused on tasks, deliveries, and event flow.",
    focus: "operations",
    scriptPath: path.resolve(process.cwd(), "apps/ops-view/server.js"),
    envPortKey: "OPS_VIEW_PORT"
  },
  {
    id: "polis",
    name: "Polis View",
    description: "A restrained linear-reading observer for long-form specs, research, and design-system work.",
    focus: "linear-reading",
    scriptPath: path.resolve(process.cwd(), "apps/polis-view/server.js"),
    envPortKey: "POLIS_VIEW_PORT"
  },
  {
    id: "emerge",
    name: "Emerge View",
    description: "An observer for spatial relationships and emergent structure, useful for watching roles, channels, and situations take shape.",
    focus: "emergence",
    scriptPath: path.resolve(process.cwd(), "apps/emerge-view/server.js"),
    envPortKey: "EMERGE_VIEW_PORT"
  },
  {
    id: "story",
    name: "Story View",
    description: "An observer tuned for narrative pacing and event progression across multiple characters.",
    focus: "narrative",
    scriptPath: path.resolve(process.cwd(), "apps/story-view/server.js"),
    envPortKey: "STORY_VIEW_PORT"
  },
  {
    id: "live",
    name: "Live Room",
    description: "A stage-like observer suited for demos, showcases, and hosted multi-agent worlds.",
    focus: "showcase-stage",
    scriptPath: path.resolve(process.cwd(), "apps/live-room-view/server.js"),
    envPortKey: "LIVE_ROOM_VIEW_PORT"
  }
];

function toTemplateSummary(template) {
  return {
    id: template.id,
    name: template.name,
    description: template.description || "",
    focus: template.focus || "",
    portEnvKey: template.envPortKey
  };
}

export class ObserverTemplateRegistry {
  constructor(templates = []) {
    this.templates = new Map();
    for (const template of templates) {
      this.register(template);
    }
  }

  register(template) {
    if (!template?.id) {
      throw new Error("observer_template_id_required");
    }
    this.templates.set(template.id, template);
    return template;
  }

  get(templateId) {
    return this.templates.get(templateId) || null;
  }

  list() {
    return Array.from(this.templates.values()).map(toTemplateSummary);
  }
}

export function createObserverTemplateRegistry() {
  return new ObserverTemplateRegistry(DEFAULT_TEMPLATES);
}
