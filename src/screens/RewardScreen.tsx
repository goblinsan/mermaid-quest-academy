import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const rewards = [
  { icon: '⭐', name: 'Gold Star', earned: true },
  { icon: '🐚', name: 'Magic Shell', earned: true },
  { icon: '💎', name: 'Blue Diamond', earned: false },
  { icon: '🌟', name: 'Starfish Badge', earned: false },
];

export default function RewardScreen() {
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
            You completed a quest and earned these awesome rewards!
          </p>
        </div>

        {/* Rewards grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {rewards.map((reward) => (
            <Card
              key={reward.name}
              variant={reward.earned ? 'coral' : 'default'}
              className={`text-center py-6 ${!reward.earned ? 'opacity-40' : ''}`}
            >
              <div className="text-5xl mb-2">{reward.icon}</div>
              <p className="font-quest text-base text-pearl-200">{reward.name}</p>
              {reward.earned && (
                <span className="mt-2 inline-block text-xs text-coral-300 font-body">
                  ✓ Earned!
                </span>
              )}
            </Card>
          ))}
        </div>

        {/* XP Bar */}
        <Card variant="ocean" className="mb-8 text-left">
          <p className="font-quest text-ocean-300 mb-2">⚡ Experience Points</p>
          <div className="w-full bg-ocean-950 rounded-full h-4 overflow-hidden">
            <div
              className="bg-coral-gradient h-full rounded-full transition-all duration-1000"
              style={{ width: '65%' }}
            />
          </div>
          <p className="font-body text-xs text-ocean-400 mt-1 text-right">650 / 1000 XP</p>
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
