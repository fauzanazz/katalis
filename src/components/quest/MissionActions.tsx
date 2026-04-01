"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  PlayCircle,
  CheckCircle2,
  Loader2,
  Camera,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadZone } from "@/components/upload/UploadZone";
import type { UploadResultData } from "@/types/upload";

interface MissionActionsProps {
  questId: string;
  missionId: string;
  missionDay: number;
  missionTitle: string;
  status: string;
  proofPhotoUrl: string | null;
  onStatusChange: () => void;
}

export function MissionActions({
  questId,
  missionId,
  missionDay,
  missionTitle,
  status,
  proofPhotoUrl,
  onStatusChange,
}: MissionActionsProps) {
  const t = useTranslations("quest.overview");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploadedProof, setUploadedProof] = useState<UploadResultData | null>(
    null,
  );

  const handleStartMission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quest/${questId}/mission/${missionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to start mission");
      }

      setSuccessMessage(t("missionStarted"));
      setTimeout(() => setSuccessMessage(null), 3000);
      onStatusChange();
    } catch {
      setError(t("startError"));
    } finally {
      setLoading(false);
    }
  }, [questId, missionId, t, onStatusChange]);

  const handleCompleteMission = useCallback(async () => {
    if (!uploadedProof) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/quest/${questId}/mission/${missionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            proofPhotoUrl: uploadedProof.url,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to complete mission");
      }

      const data = await res.json();
      setShowConfirmDialog(false);

      if (data.questCompleted) {
        setSuccessMessage(t("allDaysComplete"));
      } else if (data.nextDayUnlocked) {
        setSuccessMessage(
          t("nextDayUnlocked", { day: missionDay + 1 }),
        );
      } else {
        setSuccessMessage(t("missionCompleted"));
      }

      setTimeout(() => setSuccessMessage(null), 4000);
      onStatusChange();
    } catch {
      setError(t("completeError"));
    } finally {
      setLoading(false);
    }
  }, [questId, missionId, missionDay, uploadedProof, t, onStatusChange]);

  const handleUploadComplete = useCallback(
    (result: UploadResultData) => {
      setUploadedProof(result);
    },
    [],
  );

  // Don't show actions for locked or completed missions
  if (status === "locked") return null;

  if (status === "completed") {
    return (
      <section
        aria-labelledby="mission-proof-section"
        className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="size-5 text-green-600 dark:text-green-400"
            aria-hidden="true"
          />
          <h3
            id="mission-proof-section"
            className="text-sm font-semibold text-green-700 dark:text-green-300"
          >
            {t("statusCompleted")}
          </h3>
        </div>
        {proofPhotoUrl && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-green-600 dark:text-green-400">
              {t("viewCompletedProof")}
            </p>
            <div className="overflow-hidden rounded-lg border border-green-200 dark:border-green-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofPhotoUrl}
                alt={t("proofPhotoAlt", {
                  day: missionDay,
                  title: missionTitle,
                })}
                className="h-auto max-h-64 w-full object-cover"
              />
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
        >
          {successMessage}
        </div>
      )}

      {/* Available: Show Start Mission button */}
      {status === "available" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
            {t("startMissionDesc")}
          </p>
          <Button
            onClick={handleStartMission}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <PlayCircle
                className="mr-2 size-4"
                aria-hidden="true"
              />
            )}
            {t("startMission")}
          </Button>
        </div>
      )}

      {/* In Progress: Show upload proof + complete button */}
      {status === "in_progress" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mb-3 flex items-center gap-2">
            <Camera
              className="size-5 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("missionInProgress")}
            </p>
          </div>

          {/* Proof photo section */}
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
              {t("proofPhoto")}
            </h4>
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              {t("proofPhotoRequired")}
            </p>

            {!uploadedProof ? (
              <UploadZone
                onUploadComplete={handleUploadComplete}
                onError={(err) => setError(err)}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/20">
                <div className="overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedProof.url}
                    alt={t("proofPhotoAlt", {
                      day: missionDay,
                      title: missionTitle,
                    })}
                    className="max-h-48 max-w-full object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedProof(null)}
                    type="button"
                  >
                    <ImageIcon className="mr-1 size-4" />
                    {t("changePhoto")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Complete button */}
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={loading || !uploadedProof}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mr-2 size-4"
                aria-hidden="true"
              />
            )}
            {t("completeMission")}
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmComplete")}</DialogTitle>
            <DialogDescription>
              {t("confirmCompleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
            >
              {t("cancelButton")}
            </Button>
            <Button
              onClick={handleCompleteMission}
              disabled={loading}
            >
              {loading ? (
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="mr-2 size-4"
                  aria-hidden="true"
                />
              )}
              {t("confirmCompleteButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
