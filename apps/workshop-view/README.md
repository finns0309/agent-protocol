# Workshop View

A read-only workshop shell for browsing and launching worlds.

Responsibilities:

- list registered scenarios
- show each scenario's:
  - recommended observer templates
  - highlights
  - starter prompt
  - initial channel structure
- launch an isolated world for each scenario
- choose on launch:
  - the `network-server` port
  - observer templates (`chat` / `ops` / `polis`)
  - observer ports
- inspect running worlds and jump to their observers or manifest

It does not:

- edit scenarios
- own runtime state
- generate agent data

The workshop is intentionally limited to browsing templates, launching processes, and inspecting instance status.

All real agent data still comes from the `network-server` instance behind each launched world.
