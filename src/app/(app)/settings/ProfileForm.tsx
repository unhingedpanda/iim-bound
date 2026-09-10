"use client";

import { updateSettings } from "@/app/actions";
import { ActionForm } from "@/components/FormFeedback";
import type { Profile } from "@/lib/data";

/**
 * The profile form, plus the one thing the server cannot do on its own.
 *
 * `refresh()` from next/cache re-renders the page but not the layout around it,
 * so a theme saved here used to take effect only after a manual reload: the row
 * said "dark", the inline script in the shell still said "system", and the
 * screen disagreed with the database until something forced a document
 * request. Applying the choice in the same tick as the successful write is both
 * the immediate feedback a settings form owes you and a fix for that gap.
 *
 * `system` removes the attribute rather than setting it, because that is what
 * the shell's own script does and the two must not drift apart.
 */
export default function ProfileForm({
  profile,
  children,
  className,
  noteClassName,
}: {
  profile: Pick<Profile, "theme">;
  children: React.ReactNode;
  className?: string;
  noteClassName?: string;
}) {
  return (
    <ActionForm
      action={updateSettings}
      className={className}
      noteClassName={noteClassName}
      onDone={(form) => {
        const theme = String(form.get("theme") ?? profile.theme);
        if (theme === "system") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = theme;
      }}
    >
      {children}
    </ActionForm>
  );
}
