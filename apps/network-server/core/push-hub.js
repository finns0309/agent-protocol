function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export class AgentPushHub {
  constructor() {
    this.connections = new Map();
  }

  subscribe(agentId, res) {
    const connection = {
      res,
      heartbeat: setInterval(() => {
        try {
          res.write(": keep-alive\n\n");
        } catch {
          // Ignore write failures. The request close handler will clean up.
        }
      }, 20000)
    };

    const bucket = this.connections.get(agentId) || new Set();
    bucket.add(connection);
    this.connections.set(agentId, bucket);

    return () => {
      clearInterval(connection.heartbeat);
      const current = this.connections.get(agentId);
      if (!current) {
        return;
      }

      current.delete(connection);
      if (!current.size) {
        this.connections.delete(agentId);
      }
    };
  }

  publish(agentId, event, data) {
    const bucket = this.connections.get(agentId);
    if (!bucket?.size) {
      return 0;
    }

    let delivered = 0;
    for (const connection of bucket) {
      try {
        writeSse(connection.res, event, data);
        delivered += 1;
      } catch {
        // Ignore broken sockets; request close handler removes them.
      }
    }

    return delivered;
  }

  publishSnapshot(agentId, triggers = []) {
    for (const trigger of triggers) {
      this.publish(agentId, "trigger", trigger);
    }
  }

  count(agentId) {
    return this.connections.get(agentId)?.size || 0;
  }
}

export function sendSseEvent(res, event, data) {
  writeSse(res, event, data);
}
