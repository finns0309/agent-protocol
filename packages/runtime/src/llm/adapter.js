export class LLMAdapter {
  async respond() {
    throw new Error("LLMAdapter.respond() must be implemented by a concrete adapter.");
  }
}
