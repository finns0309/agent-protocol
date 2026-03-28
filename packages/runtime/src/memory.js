function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeWorkingMemory(workingMemory = {}) {
  return {
    focus: Array.isArray(workingMemory.focus) ? [...workingMemory.focus] : [],
    blockers: Array.isArray(workingMemory.blockers) ? [...workingMemory.blockers] : [],
    commitments: Array.isArray(workingMemory.commitments) ? [...workingMemory.commitments] : [],
    channels: Array.isArray(workingMemory.channels) ? [...workingMemory.channels] : [],
    collaborators: Array.isArray(workingMemory.collaborators) ? [...workingMemory.collaborators] : [],
    openLoops: Array.isArray(workingMemory.openLoops) ? [...workingMemory.openLoops] : [],
    deliveries: Array.isArray(workingMemory.deliveries) ? [...workingMemory.deliveries] : []
  };
}

export class AgentMemory {
  constructor({
    summary = "",
    notes = [],
    noteLimit = 20,
    workingMemory = {},
    episodes = [],
    episodeLimit = 16
  } = {}) {
    this.summary = summary;
    this.notes = [...notes];
    this.noteLimit = noteLimit;
    this.workingMemory = normalizeWorkingMemory(workingMemory);
    this.episodes = [...episodes];
    this.episodeLimit = episodeLimit;
  }

  snapshot() {
    return clone({
      summary: this.summary,
      notes: this.notes,
      workingMemory: this.workingMemory,
      episodes: this.episodes
    });
  }

  writeSummary(summary) {
    this.summary = String(summary || "");
  }

  appendNote(note) {
    if (!note) {
      return;
    }

    this.notes.push({
      text: String(note),
      timestamp: Date.now()
    });
    this.notes = this.notes.slice(-this.noteLimit);
  }

  appendNotes(notes = []) {
    for (const note of notes) {
      this.appendNote(note);
    }
  }

  upsertWorkingItem(bucket, value, limit = 8) {
    if (!bucket || !Object.hasOwn(this.workingMemory, bucket) || !value) {
      return;
    }

    const normalized = String(value);
    const nextValues = this.workingMemory[bucket].filter((item) => item !== normalized);
    nextValues.push(normalized);
    this.workingMemory[bucket] = nextValues.slice(-limit);
  }

  removeWorkingItems(bucket, predicate) {
    if (!bucket || !Object.hasOwn(this.workingMemory, bucket) || typeof predicate !== "function") {
      return;
    }

    this.workingMemory[bucket] = this.workingMemory[bucket].filter((item) => !predicate(item));
  }

  clearWorkingBucket(bucket) {
    if (!bucket || !Object.hasOwn(this.workingMemory, bucket)) {
      return;
    }

    this.workingMemory[bucket] = [];
  }

  appendEpisode({
    kind = "event",
    channelId = "",
    text = "",
    metadata = {}
  } = {}) {
    if (!text) {
      return;
    }

    this.episodes.push({
      kind: String(kind || "event"),
      channelId: String(channelId || ""),
      text: String(text),
      metadata: clone(metadata || {}),
      timestamp: Date.now()
    });
    this.episodes = this.episodes.slice(-this.episodeLimit);
  }

  markChannel(channelId) {
    if (!channelId) {
      return;
    }

    this.upsertWorkingItem("channels", channelId, 6);
  }

  markCollaborator(agentId) {
    if (!agentId) {
      return;
    }

    this.upsertWorkingItem("collaborators", String(agentId), 10);
  }

  clearNotes() {
    this.notes = [];
  }
}
