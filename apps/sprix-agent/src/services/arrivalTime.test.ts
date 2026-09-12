import { describe, expect, it } from "vitest";
import { formatEstimatedArrivalTime } from "./arrivalTime";

describe("formatEstimatedArrivalTime", () => {
  it("formats backend business-day payout windows in Chinese", () => {
    expect(formatEstimatedArrivalTime("1-3 business days")).toBe("1-3 个工作日");
    expect(formatEstimatedArrivalTime("1 business day")).toBe("1 个工作日");
    expect(formatEstimatedArrivalTime("T+1")).toBe("T+1");
    expect(formatEstimatedArrivalTime(" 1-3 个工作日 ")).toBe("1-3 个工作日");
    expect(formatEstimatedArrivalTime(undefined)).toBe("-");
  });
});
