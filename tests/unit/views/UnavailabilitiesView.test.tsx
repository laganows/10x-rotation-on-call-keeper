import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnavailabilitiesView } from "@/components/views/UnavailabilitiesView";

const requestMock = vi.fn();

vi.mock("@/lib/http/api-client", () => ({
  useApiClient: () => ({
    request: requestMock,
  }),
}));

vi.mock("@/components/hooks/useMembersList", () => ({
  useMembersList: () => ({
    items: [{ memberId: "member-1", displayName: "Ada" }],
    loading: false,
  }),
}));

vi.mock("@/components/hooks/useUnavailabilitiesList", () => ({
  useUnavailabilitiesList: () => ({
    items: [],
    total: 0,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/dates/utc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dates/utc")>("@/lib/dates/utc");
  return {
    ...actual,
    todayUtcYyyyMmDd: () => "2024-01-10",
  };
});

describe("UnavailabilitiesView", () => {
  it("shows range error when start date is after end date", () => {
    render(<UnavailabilitiesView />);

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2024-01-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2024-01-05" } });

    expect(screen.getByText("Start date must be before or equal to end date.")).toBeInTheDocument();
  });

  it("validates add form fields before submitting", () => {
    render(<UnavailabilitiesView />);

    fireEvent.click(screen.getByRole("button", { name: "Add unavailability" }));
    fireEvent.change(screen.getByLabelText("Member", { selector: "#newMember" }), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Member is required.")).toBeInTheDocument();
    expect(screen.getByText("Day is required.")).toBeInTheDocument();
    expect(requestMock).not.toHaveBeenCalled();
  });
});
