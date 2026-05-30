import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import tsconfig from "../tsconfig.json";
import {
  FORBIDDEN_RUNTIME_DEPENDENCIES,
  PHASER_PERFORMANCE_STACK_CONSTRAINTS,
  STACK_GOVERNANCE,
  createGameConfig,
  phaserPerformanceStackEvidence
} from "./main";

const requireFromTest = createRequire(import.meta.url);

describe("ARCH-STACK-001 technology stack", () => {
  it("uses Vite, strict TypeScript, and Phaser 3 as the runtime stack", () => {
    const dependencies = packageJson.dependencies;

    expect(packageJson.scripts.build).toContain("tsc --noEmit");
    expect(packageJson.scripts.build).toContain("vite build");
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(dependencies.phaser).toMatch(/^\^3\./);
    expect(packageJson.devDependencies.vite).toBeDefined();
    expect(createGameConfig("game-root").type).toBe(Phaser.WEBGL);
  });

  it("PASS AC2: does not include forbidden runtime dependencies", () => {
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const dependencyName of FORBIDDEN_RUNTIME_DEPENDENCIES) {
      expect(allDependencies).not.toHaveProperty(dependencyName);
      expect(() => requireFromTest.resolve(dependencyName)).toThrow();
    }
  });

  it("declares Ma'at-tracked simulation as authoritative over Phaser tweens or timelines", () => {
    expect(STACK_GOVERNANCE.authoritativeMotion).toBe("maat-tracked-simulation");
    expect(STACK_GOVERNANCE.phaserTweenAuthority).toBe("forbidden");
    expect(STACK_GOVERNANCE.phaserTimelineAuthority).toBe("forbidden");
  });

  it("keeps Phaser required and outside the architecture forbidden list", () => {
    const architectureContractPath = resolve(".maat", "architecture-contract.json");
    const architectureContract = readFileSync(architectureContractPath, "utf8").toLowerCase();

    expect(architectureContract).toContain("phaser");
    expect(architectureContract).not.toContain('"forbidden":"phaser"');
    expect(architectureContract).not.toContain('"forbidden": "phaser"');
  });

  it("records Phaser WebGL mobile performance constraints as stack governance", () => {
    expect(PHASER_PERFORMANCE_STACK_CONSTRAINTS).toEqual([
      "webgl",
      "single-canvas",
      "object-pools-trails",
      "particles",
      "impact-markers",
      "temporary-sprites",
      "reusable-geometry"
    ]);
    expect(STACK_GOVERNANCE.phaserPerformanceStackConstraints).toBe(
      PHASER_PERFORMANCE_STACK_CONSTRAINTS
    );
    expect(STACK_GOVERNANCE.phaserPerformanceStackEvidence).toEqual(
      phaserPerformanceStackEvidence
    );
  });
});
