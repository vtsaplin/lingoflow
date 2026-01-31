import { Button } from "@/components/ui/button";
import { Volume2, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/use-services";
import { useSettings } from "@/hooks/use-settings";

interface TTSButtonProps {
  text: string;
  speed?: number;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  "data-testid"?: string;
}

export function TTSButton({ 
  text, 
  speed = 1.0, 
  variant = "ghost", 
  size = "icon",
  className,
  "data-testid": testId
}: TTSButtonProps) {
  const tts = useTTS();
  const { settings } = useSettings();

  const handlePlay = () => {
    tts.mutate(
      { text, speed, voice: settings.ttsVoice },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play().catch(() => {});
          audio.onended = () => URL.revokeObjectURL(url);
        }
      }
    );
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={tts.isPending}
      onClick={handlePlay}
      className={className}
      data-testid={testId}
    >
      {tts.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </Button>
  );
}
