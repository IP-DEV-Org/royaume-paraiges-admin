import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/services/templateService", () => ({
  getActiveTemplates: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/services/periodService", () => ({
  getAvailablePeriodsByType: vi.fn().mockResolvedValue([]),
  getCurrentPeriodIdentifier: vi.fn(() => "2026-W18"),
}));

vi.mock("@/components/period-calendar", () => ({
  PeriodCalendar: () => null,
}));

vi.mock("@/components/establishments-picker", () => ({
  EstablishmentsPicker: () => null,
}));

import { QuestForm, type QuestFormPayload } from "../QuestForm";

function renderForm(overrides: Partial<Parameters<typeof QuestForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <QuestForm
      mode="create"
      submitLabel="Créer"
      cancelHref="/quests"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit };
}

describe("QuestForm — conversion target_value", () => {
  it("orders_count: target=5 → target_value: 5", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const nameInput = screen.getByPlaceholderText("Ex: Habitué de la semaine");
    nameInput.focus();
    await user.paste("Test orders");

    const targetInput = screen.getByLabelText(/Objectif/);
    await user.type(targetInput, "5");

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]![0] as QuestFormPayload;
    expect(payload.quest_type).toBe("orders_count");
    expect(payload.target_value).toBe(5);
  });

  it("amount_spent (édition legacy): target=50 → target_value: 5000 (centimes)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      mode: "edit",
      initial: {
        name: "Legacy",
        slug: "legacy_quest",
        questType: "amount_spent",
        targetValue: "50",
        periodType: "weekly",
      },
    });

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]![0] as QuestFormPayload;
    expect(payload.quest_type).toBe("amount_spent");
    expect(payload.target_value).toBe(5000);
  });

  it("cashback_earned: target=50 → target_value: 50 (PdB direct, PAS de conversion)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      initial: {
        name: "Cashback hebdo",
        slug: "cashback_hebdo",
        questType: "cashback_earned",
        targetValue: "50",
        periodType: "weekly",
      },
    });

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]![0] as QuestFormPayload;
    expect(payload.quest_type).toBe("cashback_earned");
    expect(payload.target_value).toBe(50);
  });

  it("bonus_cashback EUR=5 → bonus_cashback: 500 (centimes)", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      initial: {
        name: "Quete",
        slug: "quete",
        questType: "orders_count",
        targetValue: "3",
        periodType: "weekly",
        bonusCashback: "5",
      },
    });

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]![0] as QuestFormPayload;
    expect(payload.bonus_cashback).toBe(500);
  });
});

describe("QuestForm — validation cross-field", () => {
  it("consumption_count sans consumption_type → onSubmit non appelé", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      initial: {
        name: "Test",
        slug: "test",
        questType: "consumption_count",
        targetValue: "3",
        periodType: "weekly",
      },
    });

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sélectionnez le type de produit à compter."),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("nom requis", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => {
      expect(screen.getByText("Le nom est requis.")).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("slug avec caractères invalides → erreur", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({
      initial: {
        name: "Test",
        slug: "Invalid-Slug-WithCaps",
        questType: "orders_count",
        targetValue: "3",
        periodType: "weekly",
      },
    });

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Slug : uniquement \[a-z0-9_\]/),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
