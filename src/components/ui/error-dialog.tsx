"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Icon } from "@/components/icon";

/** A failure that has to be acknowledged.
 *
 *  Sits on AlertDialog rather than Dialog: `role="alertdialog"`, no
 *  outside-dismiss, no Escape, and an Action the user must press are that
 *  primitive's entire contract. The hand-rolled predecessor reimplemented
 *  all of it with three `preventDefault()` calls on a Dialog and still
 *  announced itself as a generic dialog.
 *
 *  Presentation is this system's bottom sheet, not a centred box — see the
 *  note in alert-dialog.tsx. */
export function ErrorDialog({
  open,
  title = "Couldn't complete that",
  message,
  onOk,
}: {
  open: boolean;
  title?: string;
  message?: string | null;
  onOk: () => void;
}) {
  // Toasts render above every other layer (that's what makes them ambient),
  // so a success toast still counting down when an action fails would float
  // over the blocking dialog. Clearing them keeps the failure the only thing
  // on screen asking for a decision.
  useEffect(() => {
    if (open) toast.dismiss();
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onOk()}>
      {/* Radix wires aria-describedby to the Description automatically; with
          no message there is nothing to describe, so it's left off. */}
      <AlertDialogContent aria-describedby={message ? undefined : ""}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Icon name="triangle-alert" size={17} color="var(--color-danger)" />
            {title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {message ? (
          <AlertDialogBody>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogBody>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogAction onClick={onOk}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
