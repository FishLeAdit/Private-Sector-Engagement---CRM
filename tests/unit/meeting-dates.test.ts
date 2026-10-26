import { describe, expect, it } from "vitest";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "../../src/lib/dates";
describe("meeting timezone conversion", () => {
  it("interprets calendar input in Dhaka and round-trips across UTC date boundaries", () => {
    expect(fromDhakaDateTimeInput("2026-10-27T10:30")).toBe("2026-10-27T04:30:00.000Z");
    expect(fromDhakaDateTimeInput("2026-01-01T00:15")).toBe("2025-12-31T18:15:00.000Z");
    expect(toDhakaDateTimeInput("2025-12-31T18:15:00Z")).toBe("2026-01-01T00:15");
    expect(toDhakaDateTimeInput("2026-10-27T10:30:00+06:00")).toBe("2026-10-27T10:30");
  });
  it.each(["", "2026-02-30T10:00", "2026-10-27T25:00", "2026-10-27", "2026-10-27T10:00Z"])("rejects invalid or already-zoned local input %s", value => { expect(fromDhakaDateTimeInput(value)).toBe(""); });
  it("handles empty/invalid stored timestamps and midnight without hour 24", () => {
    expect(toDhakaDateTimeInput(null)).toBe(""); expect(toDhakaDateTimeInput("invalid")).toBe("");
    expect(toDhakaDateTimeInput("2026-10-26T18:00:00Z")).toBe("2026-10-27T00:00");
    expect(() => fromDhakaDateTimeInput("0000-01-01T00:00")).not.toThrow();
  });
});
