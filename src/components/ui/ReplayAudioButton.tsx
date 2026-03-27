import Button from './Button';

interface ReplayAudioButtonProps {
  onReplay: () => void;
  isLoading?: boolean;
}

/**
 * An always-visible button that replays the current screen's audio instruction.
 * Sized for child-friendly tap targets.
 */
export default function ReplayAudioButton({ onReplay, isLoading = false }: ReplayAudioButtonProps) {
  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={onReplay}
      isLoading={isLoading}
      aria-label="Replay audio instructions"
    >
      🔊 Replay
    </Button>
  );
}
