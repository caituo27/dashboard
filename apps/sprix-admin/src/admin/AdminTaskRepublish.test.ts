import { describe, expect, it } from "vitest";
import { isTaskSlotFull } from "./AdminPages";

describe("isTaskSlotFull", () => {
  it("allows republish when remaining slots match total slots", () => {
    expect(isTaskSlotFull({ offlineReason: "手动操作下线", remainingSlots: 7, totalSlots: 7 })).toBe(false);
  });

  it("treats zero remaining slots as full", () => {
    expect(isTaskSlotFull({ offlineReason: "手动操作下线", remainingSlots: 0, totalSlots: 7 })).toBe(true);
  });

  it("uses slot-full offline reason when total slots are unavailable", () => {
    expect(isTaskSlotFull({ offlineReason: "名额已满", remainingSlots: 0, totalSlots: 0 })).toBe(true);
  });

  it("prefers remaining slots over stale offline reason", () => {
    expect(isTaskSlotFull({ offlineReason: "名额已满", remainingSlots: 1, totalSlots: 7 })).toBe(false);
  });

  it("treats slot-full offline reason with zero remaining slots as full", () => {
    expect(isTaskSlotFull({ offlineReason: "名额已满", remainingSlots: 0, totalSlots: 7 })).toBe(true);
  });
});
