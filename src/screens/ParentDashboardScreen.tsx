import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import { ZONES } from '../data/zoneConfig';

export default function ParentDashboardScreen() {
  const { xp, completedLessonIds, earnedItems, unlockedActivityIds, lessonAttempts } = useProgression();

  const totalAttempts = lessonAttempts.length;
  const correctAttempts = lessonAttempts.filter((a) => a.correct).length;
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null;

  // Build a lookup of the single attempt per lesson (each lesson can only be completed once)
  const attemptByLessonId: Record<string, (typeof lessonAttempts)[number]> = {};
  for (const attempt of lessonAttempts) {
    attemptByLessonId[attempt.lessonId] = attempt;
  }

  // Zones that have been attempted (have an entry in lessonAttempts)
  const attemptedZones = ZONES.filter((zone) => attemptByLessonId[zone.activityId] !== undefined);

  // Zones where the learner answered incorrectly — recommend revisiting
  const recommendedZones = attemptedZones.filter((zone) => !attemptByLessonId[zone.activityId].correct);

  const stats = [
    { label: 'Quests Completed', value: String(completedLessonIds.length), icon: '🎯' },
    { label: 'XP Earned', value: String(xp), icon: '⚡' },
    { label: 'Treasures Found', value: String(earnedItems.length), icon: '🐚' },
    { label: 'Zones Unlocked', value: `${unlockedActivityIds.length} / ${ZONES.length}`, icon: '🗺️' },
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

        {/* Zone Progress Overview */}
        <Card variant="glass" className="mb-8">
          <CardHeader>
            <CardTitle>🗺️ Zone Progress</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-white/10">
              {ZONES.map((zone) => {
                const isUnlocked = unlockedActivityIds.includes(zone.activityId);
                const isCompleted = completedLessonIds.includes(zone.activityId);
                const attempt = attemptByLessonId[zone.activityId];

                let statusIcon: string;
                let statusLabel: string;
                let statusClass: string;

                if (!isUnlocked) {
                  statusIcon = '🔒';
                  statusLabel = 'Locked';
                  statusClass = 'font-body text-sm text-pearl-500';
                } else if (!isCompleted) {
                  statusIcon = '🔓';
                  statusLabel = 'Unlocked';
                  statusClass = 'font-body text-sm text-ocean-300';
                } else if (attempt?.correct) {
                  statusIcon = '✅';
                  statusLabel = 'Completed — 100%';
                  statusClass = 'font-body text-sm text-seafoam-400';
                } else {
                  statusIcon = '❌';
                  statusLabel = 'Completed — 0%';
                  statusClass = 'font-body text-sm text-coral-400';
                }

                return (
                  <div key={zone.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{zone.icon}</span>
                      <p className="font-quest text-pearl-200">{zone.name}</p>
                    </div>
                    <span className={statusClass}>
                      {statusIcon} {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Accuracy Metrics per zone */}
        {totalAttempts > 0 && (
          <Card variant="glass" className="mb-8">
            <CardHeader>
              <CardTitle>📊 Accuracy by Zone</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-white/10">
                {attemptedZones.map((zone) => {
                  const attempt = attemptByLessonId[zone.activityId];
                  const pct = attempt.correct ? 100 : 0;
                  const barColor = attempt.correct ? 'bg-seafoam-400' : 'bg-coral-400';
                  const labelColor = attempt.correct ? 'text-seafoam-400' : 'text-coral-400';

                  return (
                    <div key={zone.id} className="py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-quest text-pearl-200 text-sm">
                          {zone.icon} {zone.name}
                        </span>
                        <span className={`font-quest text-sm ${labelColor}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                          className={`${barColor} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Repeat Recommendations */}
        {recommendedZones.length > 0 && (
          <Card variant="default" className="mb-8">
            <CardHeader>
              <CardTitle>🔁 Recommended to Revisit</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="font-body text-pearl-400 text-sm mb-4">
                Your child got these quests wrong. Revisiting them will help reinforce the concepts.
              </p>
              <div className="flex flex-col gap-3">
                {recommendedZones.map((zone) => (
                  <div key={zone.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{zone.icon}</span>
                      <p className="font-quest text-pearl-200">{zone.name}</p>
                    </div>
                    <Link to={`/activity/${zone.activityId}`}>
                      <Button variant="coral" size="sm">
                        Revisit
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardBody>
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
                  const zone = ZONES.find((z) => z.activityId === attempt.lessonId);
                  const accuracyLabel = attempt.correct ? '✅ 100%' : '❌ 0%';
                  const accuracyClass = attempt.correct
                    ? 'font-quest text-seafoam-400 text-lg'
                    : 'font-quest text-coral-400 text-lg';
                  return (
                    <div key={`${attempt.lessonId}-${idx}`} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-quest text-pearl-200">
                          {zone ? `${zone.icon} ${zone.name}` : `Quest #${attempt.lessonId}`}
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
