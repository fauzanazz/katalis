"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const GUEST_NAME_KEY = "guest_name";
export const GUEST_DOB_KEY = "guest_dob";

const MIN_AGE_YEARS = 3;
const MAX_AGE_YEARS = 12;

function isoForAgeYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function earliestAllowedDobIso(maxAgeYears: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - (maxAgeYears + 1));
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface GuestProfile {
  name: string;
  dob: string;
}

export function readGuestProfile(): GuestProfile | null {
  if (typeof window === "undefined") return null;
  const name = sessionStorage.getItem(GUEST_NAME_KEY);
  const dob = sessionStorage.getItem(GUEST_DOB_KEY);
  if (!name || !dob) return null;
  return { name, dob };
}

interface GuestProfileModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (profile: GuestProfile) => void;
}

export function GuestProfileModal({ open, onCancel, onSubmit }: GuestProfileModalProps) {
  const initial = useMemo<GuestProfile | null>(
    () => (open ? readGuestProfile() : null),
    [open],
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    initial?.dob ? initial.dob.slice(0, 10) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const resetForCancel = useCallback(() => {
    setError(null);
    onCancel();
  }, [onCancel]);

  const dobBounds = useMemo(
    () => ({
      min: earliestAllowedDobIso(MAX_AGE_YEARS),
      max: isoForAgeYearsAgo(MIN_AGE_YEARS),
    }),
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!dateOfBirth) {
      setError("Please enter your date of birth.");
      return;
    }
    const dobIso = new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString();
    if (dobIso < `${dobBounds.min}T00:00:00.000Z` || dobIso > `${dobBounds.max}T00:00:00.000Z`) {
      setError("We can only help children aged 3-12.");
      return;
    }

    sessionStorage.setItem(GUEST_NAME_KEY, trimmedName);
    sessionStorage.setItem(GUEST_DOB_KEY, dobIso);
    onSubmit({ name: trimmedName, dob: dobIso });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Before we explore your talents</DialogTitle>
          <DialogDescription>
            Tell us your name and birthday so we can tailor the experience to your age.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="guest-name" className="block text-sm font-medium">
              Your Name
            </label>
            <input
              id="guest-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              required
              maxLength={60}
            />
          </div>

          <div>
            <label htmlFor="guest-dob" className="block text-sm font-medium">
              Date of Birth
            </label>
            <input
              id="guest-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              min={dobBounds.min}
              max={dobBounds.max}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              We use this to choose age-appropriate activities. Children must be 3-12.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetForCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !dateOfBirth}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
