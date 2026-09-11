import { describe, expect, it } from "vitest";
import { detectSite } from "../src/adapters/registry";

describe("site registry", () => {
  it("routes known platforms and ATS domains", () => {
    expect(detectSite("https://www.zhipin.com/job_detail")?.id).toBe("boss");
    expect(detectSite("https://acme.wd5.myworkdayjobs.com/jobs")?.id).toBe("workday");
    expect(detectSite("https://jobs.mokahr.com/apply")?.id).toBe("moka");
  });

  it("does not claim a descriptor for unknown sites", () => {
    expect(detectSite("https://careers.example.org/apply")).toBeUndefined();
  });
});
