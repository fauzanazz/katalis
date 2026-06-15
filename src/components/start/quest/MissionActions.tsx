import { useState, useCallback } from "react";
import { m } from "@/paraglide/messages";
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
import { UploadZone } from "@/components/start/upload/UploadZone";
import { updateMissionFn } from "@/lib/server/quest";
import type { UploadResultData } from "@/types/upload";
import type { EarnedBadge } from "@/lib/badges";

interface MissionActionsProps {
  questId: string;
  missionId: string;
  missionDay: number;
  missionTitle: string;
  status: string;
  proofPhotoUrl: string | null;
  onStatusChange: () => void;
  onBadgesEarned?: (badges: EarnedBadge[]) => void;
}

export function MissionActions({
  questId,
  missionId,
  missionDay,
  missionTitle,
  status,
  proofPhotoUrl,
  onStatusChange,
  onBadgesEarned,
}: MissionActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploadedProof, setUploadedProof] = useState<UploadResultData | null>(
    null,
  );

  const uploadStorageKey = `katalis-upload-mission-${questId}-${missionId}`;

  const handleStartMission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await updateMissionFn({
        data: { questId, missionId, action: "start" },
      });

      if (!res.ok) {
        throw new Error("Failed to start mission");
      }

      setSuccessMessage(m.quest_overview_missionStarted());
      setTimeout(() => setSuccessMessage(null), 3000);
      onStatusChange();
    } catch {
      setError(m.quest_overview_startError());
    } finally {
      setLoading(false);
    }
  }, [questId, missionId, onStatusChange]);

  const handleCompleteMission = useCallback(async () => {
    if (!uploadedProof) return;

    setLoading(true);
    setError(null);
    try {
      const res = await updateMissionFn({
        data: {
          questId,
          missionId,
          action: "complete",
          proofPhotoUrl: uploadedProof.url,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to complete mission");
      }

      setShowConfirmDialog(false);

      // Clear scoped upload session so this mission's proof doesn't reappear elsewhere.
      try {
        sessionStorage.removeItem(uploadStorageKey);
      } catch {
        // Ignore
      }
      setUploadedProof(null);

      // Forward any newly earned badges
      if (res.newBadges && onBadgesEarned) {
        onBadgesEarned(res.newBadges);
      }

      if (res.questCompleted) {
        setSuccessMessage(m.quest_overview_allDaysComplete());
      } else if (res.nextDayUnlocked) {
        setSuccessMessage(
          m.quest_overview_nextDayUnlocked({ day: missionDay + 1 }),
        );
      } else {
        setSuccessMessage(m.quest_overview_missionCompleted());
      }

      setTimeout(() => setSuccessMessage(null), 4000);
      onStatusChange();
    } catch {
      setError(m.quest_overview_completeError());
    } finally {
      setLoading(false);
    }
  }, [questId, missionId, missionDay, uploadedProof, uploadStorageKey, onStatusChange, onBadgesEarned]);

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
        className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="size-5 text-green-600"
            aria-hidden="true"
          />
          <h3
            id="mission-proof-section"
            className="text-sm font-semibold text-green-700"
          >
            {m.quest_overview_statusCompleted()}
          </h3>
        </div>
        {proofPhotoUrl && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-green-600">
              {m.quest_overview_viewCompletedProof()}
            </p>
            <div className="overflow-hidden rounded-lg border border-green-200">
              <img
                src={proofPhotoUrl}
                alt={m.quest_overview_proofPhotoAlt({
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
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {successMessage}
        </div>
      )}

      {/* Available: Show Start Mission button */}
      {status === "available" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-700">
            {m.quest_overview_startMissionDesc()}
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
            {m.quest_overview_startMission()}
          </Button>
        </div>
      )}

      {/* In Progress: Show upload proof + complete button */}
      {status === "in_progress" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Camera
              className="size-5 text-amber-600"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-amber-700">
              {m.quest_overview_missionInProgress()}
            </p>
          </div>

          {/* Proof photo section */}
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-semibold text-amber-800">
              {m.quest_overview_proofPhoto()}
            </h4>
            <p className="mb-3 text-xs text-amber-600">
              {m.quest_overview_proofPhotoRequired()}
            </p>

            {!uploadedProof ? (
              <UploadZone
                onUploadComplete={handleUploadComplete}
                onError={(err) => setError(err)}
                storageKey={uploadStorageKey}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4">
                <div className="overflow-hidden rounded-lg">
                  <img
                    src={uploadedProof.url}
                    alt={m.quest_overview_proofPhotoAlt({
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
                    {m.quest_overview_changePhoto()}
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
            {m.quest_overview_completeMission()}
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.quest_overview_confirmComplete()}</DialogTitle>
            <DialogDescription>
              {m.quest_overview_confirmCompleteDesc()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
            >
              {m.quest_overview_cancelButton()}
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
              {m.quest_overview_confirmCompleteButton()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
