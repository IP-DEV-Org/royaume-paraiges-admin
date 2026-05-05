import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AchievementBadgeForm } from "../AchievementBadgeForm";

describe("AchievementBadgeForm", () => {
  describe("first_order (par défaut)", () => {
    it("submit avec nom + slug auto → payload sans criterion_params", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <AchievementBadgeForm
          submitLabel="Créer"
          onSubmit={onSubmit}
          onCancel={() => {}}
        />,
      );

      const nameInput = screen.getByPlaceholderText("ex: Habitué");
      // Paste pour que generateSlug s'exécute une fois sur "Habitue" complet
      // (le auto-slug ne s'applique que tant que le slug est vide).
      nameInput.focus();
      await user.paste("Habitue");

      const submitBtn = screen.getByRole("button", { name: /Créer/i });
      await user.click(submitBtn);

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      const payload = onSubmit.mock.calls[0]![0];
      expect(payload).toMatchObject({
        name: "Habitue",
        slug: "achievement_habitue",
        criterion_type: "first_order",
        evaluation_mode: "realtime",
        criterion_params: {},
        rarity: "common",
      });
    });
  });

  describe("validation", () => {
    it("nom vide → message d'erreur, onSubmit non appelé", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <AchievementBadgeForm
          submitLabel="Créer"
          onSubmit={onSubmit}
          onCancel={() => {}}
        />,
      );

      const submitBtn = screen.getByRole("button", { name: /Créer/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Le nom est requis.")).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("erreur serveur", () => {
    it("affiche un bandeau quand onSubmit throw", async () => {
      const user = userEvent.setup();
      const onSubmit = vi
        .fn()
        .mockRejectedValue(new Error("Slug déjà existant en BDD"));

      render(
        <AchievementBadgeForm
          submitLabel="Créer"
          onSubmit={onSubmit}
          onCancel={() => {}}
        />,
      );

      const nameInput = screen.getByPlaceholderText("ex: Habitué");
      nameInput.focus();
      await user.paste("Test");
      await user.click(screen.getByRole("button", { name: /Créer/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Slug déjà existant en BDD"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("mode édition (lockSlug)", () => {
    it("le slug n'est pas auto-régénéré sur changement de nom", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <AchievementBadgeForm
          lockSlug
          submitLabel="Enregistrer"
          onSubmit={onSubmit}
          onCancel={() => {}}
          initial={{
            slug: "achievement_pionnier",
            name: "Pionnier",
            criterion_type: "first_order",
            evaluation_mode: "realtime",
            rarity: "epic",
          }}
        />,
      );

      const nameInput = screen.getByDisplayValue("Pionnier");
      await user.clear(nameInput);
      await user.type(nameInput, "Légende");

      // Le slug reste identique car lockSlug est actif
      expect(screen.getByDisplayValue("achievement_pionnier")).toBeInTheDocument();
    });
  });
});
