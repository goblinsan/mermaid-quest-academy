import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';

const features = [
  { icon: '🗺️', title: 'World Map', desc: 'Explore the ocean kingdoms and unlock new areas!', to: '/world' },
  { icon: '🎯', title: 'Quests', desc: 'Complete fun learning activities to earn treasures.', to: '/world' },
  { icon: '⭐', title: 'Rewards', desc: 'Collect stars, badges, and magical items!', to: '/reward' },
];

export default function HomeScreen() {
  return (
    <div className="min-h-screen px-4 py-12">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="mb-4 text-8xl animate-float inline-block">🧜‍♀️</div>
        <h1 className="font-quest text-5xl text-shadow-glow text-ocean-200 mb-4">
          Welcome to Mermaid Quest Academy!
        </h1>
        <p className="font-body text-lg text-pearl-300 mb-8 max-w-xl mx-auto">
          Dive into an underwater world of learning adventures. Solve puzzles, collect treasures,
          and become the greatest mermaid scholar in all the seas!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/session">
            <Button variant="primary" size="xl">
              📖 Start Reading Session
            </Button>
          </Link>
          <Link to="/world">
            <Button variant="secondary" size="xl">
              🌊 World Map
            </Button>
          </Link>
          <Link to="/parent">
            <Button variant="ghost" size="xl">
              👨‍👩‍👧 Parent Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl mt-16">
        <h2 className="font-quest text-3xl text-center text-ocean-300 mb-8">
          ✨ What awaits you beneath the waves ✨
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {features.map(({ icon, title, desc, to }) => (
            <Link key={title} to={to}>
              <Card variant="glass" hoverable className="h-full text-center">
                <div className="text-5xl mb-3">{icon}</div>
                <CardHeader>
                  <CardTitle className="text-center">{title}</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-sm">{desc}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
