import { describe, expect, it } from "vitest";
import { isTaskSlotFull } from "./AdminPages";

describe("isTaskSlotFull", () => {
  it("treats slot count matching total slots as full", () => {
    expect(isTaskSlotFull({ offlineReason: "手动操作下线", remainingSlots: 7, totalSlots: 7 })).toBe(true);
  });

  it("allows republish when slot count is below total slots", () => {
    expect(isTaskSlotFull({ offlineReason: "手动操作下线", remainingSlots: 0, totalSlots: 7 })).toBe(false);
  });

  it("treats slot-full offline reason as full regardless of slot count", () => {
    expect(isTaskSlotFull({ offlineReason: "名额已满", remainingSlots: 0, totalSlots: 7 })).toBe(true);
  });
});
