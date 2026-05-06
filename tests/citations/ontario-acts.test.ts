import { describe, it, expect } from "vitest";
import { findOntarioAct } from "@/lib/citations/ontario-acts";

describe("findOntarioAct", () => {
  it("returns null for unknown act names", () => {
    expect(findOntarioAct("Some Made-Up Statute Act")).toBeNull();
    expect(findOntarioAct("")).toBeNull();
  });

  it("matches exact full name", () => {
    const act = findOntarioAct("Employment Standards Act, 2000");
    expect(act).not.toBeNull();
    expect(act?.code).toBe("00e41");
  });

  it("matches without the year suffix", () => {
    const act = findOntarioAct("Employment Standards Act");
    expect(act).not.toBeNull();
    expect(act?.code).toBe("00e41");
  });

  it("is case-insensitive", () => {
    const act = findOntarioAct("EMPLOYMENT STANDARDS ACT, 2000");
    expect(act?.code).toBe("00e41");
  });

  it("tolerates extra whitespace", () => {
    const act = findOntarioAct("  Employment   Standards   Act,   2000  ");
    expect(act?.code).toBe("00e41");
  });

  it("finds Labour Relations Act, 1995", () => {
    const act = findOntarioAct("Labour Relations Act, 1995");
    expect(act?.code).toBe("95l01");
  });

  it("finds Human Rights Code (no year)", () => {
    const act = findOntarioAct("Human Rights Code");
    expect(act?.code).toBe("90h20");
  });

  it("finds Limitations Act, 2002 (year-disambiguated)", () => {
    const act = findOntarioAct("Limitations Act, 2002");
    expect(act?.code).toBe("02l24");
  });

  it("does substring matching for partial inputs", () => {
    const act = findOntarioAct("the Employment Standards");
    expect(act).not.toBeNull();
  });

  it("returns a unique code-fullName pair", () => {
    const act = findOntarioAct("Occupational Health and Safety Act");
    expect(act).toBeTruthy();
    expect(act?.code).toMatch(/^[0-9a-z]+$/i);
    expect(act?.fullName).toContain("Occupational");
  });
});
