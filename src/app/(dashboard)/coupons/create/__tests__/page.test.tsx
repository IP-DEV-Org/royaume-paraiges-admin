import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  createManualCoupon: vi.fn().mockResolvedValue({ id: 1 }),
  searchCustomers: vi.fn().mockResolvedValue([
    {
      id: "11111111-1111-4111-8111-111111111111",
      first_name: "Alice",
      last_name: "Test",
      email: "alice@test.com",
    },
  ]),
  getActiveTemplates: vi.fn().mockResolvedValue([
    {
      id: 10,
      name: "Bonus 5€",
      amount: 500,
      percentage: null,
      description: "Coupon test",
    },
  ]),
  push: vi.fn(),
}));

vi.mock("@/lib/services/couponService", () => ({
  createManualCoupon: mocks.createManualCoupon,
  searchCustomers: mocks.searchCustomers,
}));

vi.mock("@/lib/services/templateService", () => ({
  getActiveTemplates: mocks.getActiveTemplates,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-uuid" } },
      }),
    },
  }),
}));

import CreateCouponPage from "../page";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CreateCouponPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.createManualCoupon.mockClear();
  mocks.createManualCoupon.mockResolvedValue({ id: 1 });
  mocks.push.mockClear();
  mocks.searchCustomers.mockClear();
  mocks.getActiveTemplates.mockClear();
});

describe("CreateCouponPage", () => {
  it("submit sans utilisateur sélectionné → erreur de validation", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(mocks.getActiveTemplates).toHaveBeenCalled(),
    );

    await user.click(screen.getByRole("button", { name: /Attribuer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sélectionnez un utilisateur"),
      ).toBeInTheDocument();
    });
    expect(mocks.createManualCoupon).not.toHaveBeenCalled();
  });

  it("submit avec user mais sans template (mode template par défaut) → erreur", async () => {
    const user = userEvent.setup();
    renderPage();

    // Sélection utilisateur via search
    const searchInput = screen.getByPlaceholderText(/Rechercher/i);
    await user.type(searchInput, "Alice");
    await waitFor(() => expect(mocks.searchCustomers).toHaveBeenCalled(), {
      timeout: 1500,
    });
    await user.click(await screen.findByText("Alice Test"));

    // Submit sans choisir de template → schema XOR doit échouer
    await user.click(screen.getByRole("button", { name: /Attribuer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sélectionnez un template."),
      ).toBeInTheDocument();
    });
    expect(mocks.createManualCoupon).not.toHaveBeenCalled();
  });
});
