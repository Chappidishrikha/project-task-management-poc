import { describe, expect, it } from "vitest";
import { isTaskPriority, isTaskStatus, statuses, priorities } from "./types";

describe("task domain values", () => {
  it("accepts each supported workflow status", () => {
    for (const status of statuses) expect(isTaskStatus(status)).toBe(true);
  });

  it("rejects an unsupported status", () => {
    expect(isTaskStatus("Blocked")).toBe(false);
  });

  it("accepts the four supported priorities", () => {
    for (const priority of priorities) expect(isTaskPriority(priority)).toBe(true);
  });
});
