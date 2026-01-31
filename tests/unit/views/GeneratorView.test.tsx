import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GeneratorView } from "@/components/views/GeneratorView";

vi.mock("@/components/hooks/usePlanPreview", () => ({
  usePlanPreview: () => ({
    status: "idle",
    data: null,
    error: null,
    previewKey: null,
    generatePreview: vi.fn(),
  }),
}));

vi.mock("@/components/hooks/useSavePlan", () => ({
  useSavePlan: () => ({
    status: "idle",
    error: null,
    savePlan: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/lib/dates/utc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dates/utc")>("@/lib/dates/utc");
  return {
    ...actual,
    todayUtcYyyyMmDd: () => "2024-01-10",
  };
});

describe("GeneratorView", () => {
  it("shows error when start date is after end date", () => {
    render(<GeneratorView />);

    fireEvent.change(screen.getByLabelText("Start date (UTC)"), { target: { value: "2024-01-10" } });
    fireEvent.change(screen.getByLabelText("End date (UTC)"), { target: { value: "2024-01-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    expect(screen.getByText("Start date must be before or equal to end date.")).toBeInTheDocument();
  });

  it("shows error when start date is before today (UTC)", () => {
    render(<GeneratorView />);

    fireEvent.change(screen.getByLabelText("Start date (UTC)"), { target: { value: "2024-01-09" } });
    fireEvent.change(screen.getByLabelText("End date (UTC)"), { target: { value: "2024-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    expect(screen.getByText("Start date must be today or later (UTC).")).toBeInTheDocument();
  });
});
