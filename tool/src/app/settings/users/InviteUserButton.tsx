"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InviteUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        Invite User
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite a Team Member</DialogTitle>
            <DialogDescription>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                <p>
                  The Presales Tool uses{" "}
                  <span className="font-medium text-foreground">
                    Google SSO with domain restriction
                  </span>
                  . Any team member with a valid company email address can sign
                  in — no manual invitation is required.
                </p>
                <p>
                  Once they sign in for the first time, their account is
                  automatically created with the{" "}
                  <span className="font-medium text-foreground">Viewer</span>{" "}
                  role. An Admin can then upgrade their role from this page.
                </p>
                <p className="text-xs">
                  Allowed domain:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "qed42.com"}
                  </code>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
