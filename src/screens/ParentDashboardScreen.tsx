import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';

const stats = [
  { label: 'Quests Completed', value: '3', icon: '🎯' },
  { label: 'Stars Earned', value: '12', icon: '⭐' },
  { label: 'Time Spent', value: '45 min', icon: '⏱️' },
  { label: 'Current Streak', value: '5 days', icon: '🔥' },
];

const recentActivity = [
  { quest: 'Coral Reef Cove', score: '100%', date: 'Today' },
  { quest: 'Kelp Forest', score: '85%', date: 'Yesterday' },
  { quest: 'Coral Reef Cove', score: '90%', date: '2 days ago' },
];

export default function ParentDashboardScreen() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">👨‍👩‍👧</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            Parent Dashboard
          </h1>
          <p className="font-body text-pearl-300">
            Track your child's learning progress in Mermaid Quest Academy
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon }) => (
            <Card key={label} variant="ocean" className="text-center">
              <div className="text-3xl mb-1">{icon}</div>
              <p className="font-quest text-2xl text-ocean-200">{value}</p>
              <p className="font-body text-xs text-ocean-400 mt-1">{label}</p>
            </Card>
          ))}
        </div>

        {/* Recent activity */}
        <Card variant="glass" className="mb-8">
          <CardHeader>
            <CardTitle>📋 Recent Activity</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-white/10">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-quest text-pearl-200">{item.quest}</p>
                    <p className="font-body text-xs text-ocean-400">{item.date}</p>
                  </div>
                  <span className="font-quest text-seafoam-400 text-lg">{item.score}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Settings placeholder */}
        <Card variant="default" className="mb-8">
          <CardHeader>
            <CardTitle>⚙️ Settings</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="font-body text-pearl-400 text-sm">
              Parental controls, difficulty settings, and account management will appear here.
            </p>
          </CardBody>
        </Card>

        <div className="text-center">
          <Link to="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
