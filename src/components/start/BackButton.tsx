import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocaleRouter } from "@/i18n/start-navigation";

export function BackButton() {
  const router = useLocaleRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      aria-label="Go back"
      className="shrink-0"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
