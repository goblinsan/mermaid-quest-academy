import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const zones = [
  { id: 'coral-reef', name: 'Coral Reef Cove', icon: '🐠', unlocked: true, activityId: '1' },
  { id: 'kelp-forest', name: 'Kelp Forest', icon: '🌿', unlocked: true, activityId: '2' },
  { id: 'sunken-ship', name: 'Sunken Ship', icon: '⚓', unlocked: false, activityId: '3' },
  { id: 'deep-abyss', name: 'The Deep Abyss', icon: '🌑', unlocked: false, activityId: '4' },
  { id: 'pearl-palace', name: 'Pearl Palace', icon: '🏰', unlocked: false, activityId: '5' },
  { id: 'volcano-vent', name: 'Volcano Vent', icon: '🌋', unlocked: false, activityId: '6' },
];

export default function WorldMapScreen() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            🗺️ Ocean World Map
          </h1>
          <p className="font-body text-pearl-300">
            Choose a zone to begin your learning quest!
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {zones.map((zone) => (
            <div key={zone.id}>
              {zone.unlocked ? (
                <Link to={`/activity/${zone.activityId}`}>
                  <Card variant="ocean" hoverable className="text-center py-10 min-h-[160px] flex flex-col items-center justify-center">
                    <div className="text-6xl mb-3">{zone.icon}</div>
                    <p className="font-quest text-lg text-ocean-200">{zone.name}</p>
                    <p className="text-sm text-ocean-400 mt-1">Tap to explore!</p>
                  </Card>
                </Link>
              ) : (
                <Card variant="default" className="text-center py-10 opacity-50 min-h-[160px] flex flex-col items-center justify-center">
                  <div className="text-6xl mb-3">🔒</div>
                  <p className="font-quest text-lg text-pearl-400">{zone.name}</p>
                  <p className="text-sm text-pearl-500 mt-1">Complete earlier quests to unlock</p>
                </Card>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
