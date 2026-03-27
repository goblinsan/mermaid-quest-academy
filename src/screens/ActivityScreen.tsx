import { useParams, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function ActivityScreen() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            Quest #{id}
          </h1>
          <p className="font-body text-pearl-300">
            Complete this activity to earn stars and advance in the ocean world!
          </p>
        </div>

        <Card variant="glass" className="mb-6">
          <h2 className="font-quest text-2xl text-ocean-300 mb-4">📜 Quest Challenge</h2>
          <p className="font-body text-pearl-200 mb-6">
            This is where your learning activity will appear. Solve the puzzle, answer the
            question, or complete the challenge to earn your reward!
          </p>

          {/* Placeholder activity area */}
          <div className="rounded-xl border-2 border-dashed border-ocean-600/50 bg-ocean-900/30 p-10 text-center">
            <p className="font-quest text-lg text-ocean-400">
              🌊 Activity #{id} content coming soon… 🌊
            </p>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <Link to="/world">
            <Button variant="ghost">← Back to World Map</Button>
          </Link>
          <Link to="/reward">
            <Button variant="coral">🏆 Complete &amp; Claim Reward!</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
