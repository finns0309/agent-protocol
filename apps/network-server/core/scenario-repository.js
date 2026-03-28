import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateScenarioSpec } from "./scenario-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_SCENARIO_SPECS_DIR = path.resolve(
  __dirname,
  "../../../data/workshop/scenarios"
);

export class FileScenarioRepository {
  constructor({ directory = DEFAULT_SCENARIO_SPECS_DIR } = {}) {
    this.directory = directory;
  }

  listEntries() {
    return readdirSync(this.directory)
      .map((entry) => {
        const fullPath = path.join(this.directory, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          return {
            id: entry,
            filePath: path.join(fullPath, "scenario.json"),
            sourceName: entry
          };
        }
        if (entry.endsWith(".json")) {
          return {
            id: entry.replace(/\.json$/, ""),
            filePath: fullPath,
            sourceName: entry.replace(/\.json$/, "")
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  list() {
    return this.listEntries().map((entry) => this.readFromEntry(entry));
  }

  get(id) {
    try {
      return this.readOne(id);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  readOne(id) {
    const directoryEntry = {
      id,
      filePath: path.join(this.directory, id, "scenario.json"),
      sourceName: id
    };
    try {
      return this.readFromEntry(directoryEntry);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    const fileEntry = {
      id,
      filePath: path.join(this.directory, `${id}.json`),
      sourceName: id
    };
    return this.readFromEntry(fileEntry);
  }

  readFromEntry(entry) {
    const raw = JSON.parse(readFileSync(entry.filePath, "utf8"));
    const spec = validateScenarioSpec(raw, entry.sourceName);
    return {
      ...spec,
      source: {
        kind: path.basename(entry.filePath) === "scenario.json" ? "bundle" : "file",
        path: entry.filePath
      }
    };
  }
}

export function createDefaultScenarioRepository() {
  return new FileScenarioRepository();
}
