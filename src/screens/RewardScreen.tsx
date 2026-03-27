import { Link, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import type { RewardNavigationState } from '../types/progression';

/** Total XP obtainable by completing every lesson. */
const MAX_XP = 525;

export default function RewardScreen() {
  const location = useLocation();
  const navState = location.state as RewardNavigationState | null;
  const { xp, earnedItems } = useProgression();

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        {/* Celebration */}
        <div className="mb-6">
          <div className="text-7xl mb-4 animate-wave inline-block">🎉</div>
          <h1 className="font-quest text-4xl text-coral-300 text-shadow mb-2">
            Amazing Work!
          </h1>
          <p className="font-body text-pearl-300 text-lg">
            {navState?.reward
              ? `You earned ${navState.reward.xp} XP and a ${navState.reward.item} ${navState.reward.emoji}!`
              : 'You completed a quest and earned awesome rewards!'}
          </p>
          {navState?.newZoneUnlocked && (
            <div className="mt-4 rounded-2xl bg-ocean-700/60 border-2 border-ocean-400 px-6 py-3 font-quest text-ocean-200">
              🗺️ New zone unlocked! Head to the World Map to explore!
            </div>
          )}
        </div>

        {/* Treasure collection */}
        {earnedItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {earnedItems.map((earned, i) => {
              const isJustEarned =
                navState?.reward != null &&
                i === earnedItems.length - 1 &&
                earned.item === navState.reward.item;
              return (
                <Card
                  key={`${earned.item}-${i}`}
                  variant={isJustEarned ? 'coral' : 'ocean'}
                  className="text-center py-6"
                >
                  <div className="text-5xl mb-2">{earned.emoji}</div>
                  <p className="font-quest text-base text-pearl-200">{earned.item}</p>
                  {isJustEarned && (
                    <span className="mt-2 inline-block text-xs text-coral-300 font-body">
                      ✓ Just earned!
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card variant="default" className="mb-8 text-center py-8 opacity-60">
            <p className="font-body text-pearl-400">Complete quests to collect treasures!</p>
          </Card>
        )}

        {/* XP Bar */}
        <Card variant="ocean" className="mb-8 text-left">
          <p className="font-quest text-ocean-300 mb-2">⚡ Experience Points</p>
          <div className="w-full bg-ocean-950 rounded-full h-4 overflow-hidden">
            <div
              className="bg-coral-gradient h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, Math.round((xp / MAX_XP) * 100))}%` }}
            />
          </div>
          <p className="font-body text-xs text-ocean-400 mt-1 text-right">{xp} / {MAX_XP} XP</p>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/world">
            <Button variant="primary" size="lg">
              🗺️ Continue Exploring!
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="lg">
              🏠 Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
