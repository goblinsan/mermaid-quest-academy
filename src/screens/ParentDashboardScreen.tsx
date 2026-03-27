import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import { ZONES } from '../data/zoneConfig';

const ZONE_NAME_BY_ACTIVITY_ID: Record<string, string> = Object.fromEntries(
  ZONES.map((z) => [z.activityId, z.name]),
);

export default function ParentDashboardScreen() {
  const { xp, completedLessonIds, earnedItems, unlockedActivityIds, lessonAttempts } = useProgression();

  const totalAttempts = lessonAttempts.length;
  const correctAttempts = lessonAttempts.filter((a) => a.correct).length;
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;

  const stats = [
    { label: 'Quests Completed', value: String(completedLessonIds.length), icon: '🎯' },
    { label: 'XP Earned', value: String(xp), icon: '⚡' },
    { label: 'Treasures Found', value: String(earnedItems.length), icon: '🐚' },
    { label: 'Zones Unlocked', value: `${unlockedActivityIds.length} / 6`, icon: '🗺️' },
  ];

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

        {/* Overall accuracy */}
        {overallAccuracy !== null && (
          <Card variant="ocean" className="text-center mb-8">
            <div className="text-3xl mb-1">🎯</div>
            <p className="font-quest text-2xl text-ocean-200">{overallAccuracy}%</p>
            <p className="font-body text-xs text-ocean-400 mt-1">
              Overall Accuracy ({correctAttempts} / {totalAttempts} correct)
            </p>
          </Card>
        )}

        {/* Recent activity */}
        <Card variant="glass" className="mb-8">
          <CardHeader>
            <CardTitle>📋 Recent Activity</CardTitle>
          </CardHeader>
          <CardBody>
            {completedLessonIds.length === 0 ? (
              <p className="font-body text-pearl-400 text-sm">No quests completed yet. Start exploring!</p>
            ) : (
              <div className="divide-y divide-white/10">
                {[...lessonAttempts].reverse().map((attempt, idx) => {
                  const accuracyLabel = attempt.correct ? '✅ 100%' : '❌ 0%';
                  const accuracyClass = attempt.correct
                    ? 'font-quest text-seafoam-400 text-lg'
                    : 'font-quest text-coral-400 text-lg';
                  return (
                    <div key={`${attempt.lessonId}-${idx}`} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-quest text-pearl-200">
                          {ZONE_NAME_BY_ACTIVITY_ID[attempt.lessonId] ?? `Quest #${attempt.lessonId}`}
                        </p>
                        <p className="font-body text-xs text-ocean-400">
                          {new Date(attempt.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={accuracyClass}>{accuracyLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
