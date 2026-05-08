import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  toCanLIIJurisdiction,
  searchCanLIILegislation,
  searchCanLIICases,
  CANLII_JURISDICTION_CODES,
} from "@/lib/citations/canlii";

// ── toCanLIIJurisdiction ──────────────────────────────────────────────────────

describe("toCanLIIJurisdiction", () => {
  it("maps ontario → on", () => expect(toCanLIIJurisdiction("ontario")).toBe("on"));
  it("maps federal → ca", () => expect(toCanLIIJurisdiction("federal")).toBe("ca"));
  it("maps canada → ca", () => expect(toCanLIIJurisdiction("canada")).toBe("ca"));
  it("is case-insensitive", () => expect(toCanLIIJurisdiction("Ontario")).toBe("on"));
  it("trims whitespace", () => expect(toCanLIIJurisdiction("  ontario  ")).toBe("on"));
  it("returns null for hk (not in CanLII)", () => expect(toCanLIIJurisdiction("hk")).toBeNull());
  it("returns null for unknown jurisdiction", () => expect(toCanLIIJurisdiction("narnia")).toBeNull());
  it("has entries for all major provinces", () => {
    const required = ["on", "bc", "ab", "qc", "ca"];
    const values = Object.values(CANLII_JURISDICTION_CODES);
    for (const code of required) {
      expect(values).toContain(code);
    }
  });
});

// ── API call tests (fetch mocked) ─────────────────────────────────────────────

const MOCK_LEG_RESPONSE = {
  resultInfo: { totalCount: 1 },
  results: [
    {
      databaseId: "onst",
      legislationId: "rso-2000-c-e14",
      title: "Employment Standards Act, 2000",
      citation: "SO 2000, c 41",
      url: "https://www.canlii.org/en/on/laws/stat/so-2000-c-41/latest/so-2000-c-41.html",
    },
  ],
};

const MOCK_CASE_RESPONSE = {
  resultInfo: { totalCount: 1 },
  results: [
    {
      databaseId: "onca",
      caseId: "2019onca123",
      title: "Smith v Jones",
      citation: "2019 ONCA 123",
      url: "https://www.canlii.org/en/on/onca/doc/2019/2019onca123/2019onca123.html",
      decisionDate: "2019-03-15",
      court: { name: "Court of Appeal for Ontario" },
    },
  ],
};

describe("searchCanLIILegislation (fetch mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok:false with no-key when apiKey is empty", async () => {
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("no-key");
  });

  it("returns ok:false with auth-error on 401", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "bad-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("auth-error");
  });

  it("returns ok:false with auth-error on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "expired");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("auth-error");
  });

  it("returns ok:false with network-error on non-200/401/403", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("network-error");
  });

  it("returns ok:false with network-error on fetch throw", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("network-error");
      expect(result.message).toContain("ECONNREFUSED");
    }
  });

  it("parses a successful legislation response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_LEG_RESPONSE), { status: 200 })
    );
    const result = await searchCanLIILegislation("Employment Standards Act", "on", "valid-key");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].title).toBe("Employment Standards Act, 2000");
      expect(result.hits[0].databaseId).toBe("onst");
      expect(result.totalCount).toBe(1);
    }
  });

  it("returns empty hits array when results are missing", async () => {
    vi.mocked(fetch)
      // first call (with jurisdiction): 200 but empty
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      // second call (broader search fallback): also empty
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const result = await searchCanLIILegislation("Unknown Act", "on", "valid-key");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hits).toHaveLength(0);
  });
});

describe("searchCanLIICases (fetch mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok:false with no-key when apiKey is empty", async () => {
    const result = await searchCanLIICases("Smith v Jones", "on", "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("no-key");
  });

  it("returns ok:false with auth-error on 401", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const result = await searchCanLIICases("Smith v Jones", "on", "bad-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKind).toBe("auth-error");
  });

  it("parses a successful case response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_CASE_RESPONSE), { status: 200 })
    );
    const result = await searchCanLIICases("Smith v Jones", "on", "valid-key");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].title).toBe("Smith v Jones");
      expect(result.hits[0].citation).toBe("2019 ONCA 123");
      expect(result.hits[0].court).toBe("Court of Appeal for Ontario");
      expect(result.hits[0].decisionDate).toBe("2019-03-15");
    }
  });

  it("works without jurisdictionCode (undefined)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(MOCK_CASE_RESPONSE), { status: 200 })
    );
    const result = await searchCanLIICases("Smith v Jones", undefined, "key");
    expect(result.ok).toBe(true);
    // Verify the URL did NOT include a jurisdiction filter
    const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(calledUrl).not.toContain("jurisdiction=");
  });

  it("error message is user-readable, not a raw status code string", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const result = await searchCanLIICases("Smith v Jones", "on", "old-key");
    if (!result.ok) expect(result.message.toLowerCase()).toMatch(/invalid|expired/);
  });
});
