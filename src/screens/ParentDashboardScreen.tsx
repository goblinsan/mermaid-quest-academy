import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import { ZONES } from '../data/zoneConfig';
import { getAllReadingActivities } from '../services/activityLoader';

/** SATPIN sounds in curriculum order. */
const SATPIN_SOUNDS = ['s', 'a', 't', 'p', 'i', 'n'] as const;

/**
 * Accuracy threshold (as a fraction 0–1) below which a sound is flagged as
 * a weak target requiring reinforcement (issue #112).
 * Only applied when the learner has at least MIN_ATTEMPTS_FOR_RECOMMENDATION
 * attempts for that sound.
 */
const WEAK_SOUND_ACCURACY_THRESHOLD = 0.6;

/** Minimum number of attempts before flagging a sound as weak (issue #112). */
const MIN_ATTEMPTS_FOR_RECOMMENDATION = 3;

export default function ParentDashboardScreen() {
  const {
    xp,
    completedLessonIds,
    earnedItems,
    unlockedActivityIds,
    lessonAttempts,
    phonicsMastery,
    introducedSounds,
    unlockedCvcWords,
    sessionHistory,
  } = useProgression();

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

  // --------------------------------------------------------------------------
  // Phonics sound progress (issue #111)
  // --------------------------------------------------------------------------
  const masteredSounds = SATPIN_SOUNDS.filter((sound) => {
    const m = phonicsMastery[sound];
    return m !== undefined && m.consecutiveCorrect >= 2;
  });

  // --------------------------------------------------------------------------
  // Weak phonics targets for recommendations (issue #112)
  // --------------------------------------------------------------------------
  const weakSounds = SATPIN_SOUNDS.filter((sound) => {
    const m = phonicsMastery[sound];
    if (!m || m.attemptCount < MIN_ATTEMPTS_FOR_RECOMMENDATION) return false;
    return m.correctCount / m.attemptCount < WEAK_SOUND_ACCURACY_THRESHOLD;
  });

  // For each weak sound, find the lowest-level unplayed activity targeting it
  const allActivities = getAllReadingActivities();
  const completedSet = new Set(completedLessonIds);
  const weakSoundRecommendations = weakSounds.flatMap((sound) => {
    const candidate = allActivities
      .filter((a) => a.progression.targetSound === sound)
      .sort((a, b) => a.progression.difficultyLevel - b.progression.difficultyLevel)
      .find((a) => !completedSet.has(a.id));
    return candidate ? [{ sound, activity: candidate }] : [];
  });

  const stats = [
    { label: 'Quests Completed', value: String(completedLessonIds.length), icon: '🎯' },
    { label: 'XP Earned', value: String(xp), icon: '⚡' },
    { label: 'Treasures Found', value: String(earnedItems.length), icon: '🐚' },
    { label: 'Zones Unlocked', value: `${unlockedActivityIds.length} / ${ZONES.length}`, icon: '🗺️' },
    { label: 'Sessions Done', value: String(sessionHistory.length), icon: '📖' },
    { label: 'CVC Words', value: String(unlockedCvcWords.length), icon: '🔤' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
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

        {/* Phonics Sounds Progress (issue #111) */}
        <Card variant="glass" className="mb-8">
          <CardHeader>
            <CardTitle>🔤 Phonics Sounds Progress</CardTitle>
          </CardHeader>
          <CardBody>
            {introducedSounds.length === 0 ? (
              <p className="font-body text-pearl-400 text-sm">
                No sounds introduced yet. Start a reading session to begin!
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {SATPIN_SOUNDS.map((sound) => {
                  const mastery = phonicsMastery[sound];
                  const isIntroduced = introducedSounds.includes(sound);
                  const isMastered = masteredSounds.includes(sound);
                  const accuracy =
                    mastery && mastery.attemptCount > 0
                      ? Math.round((mastery.correctCount / mastery.attemptCount) * 100)
                      : null;

                  let bgColor = 'bg-white/5';
                  let labelColor = 'text-pearl-500';
                  let statusEmoji = '⬜';

                  if (isMastered) {
                    bgColor = 'bg-seafoam-400/20';
                    labelColor = 'text-seafoam-400';
                    statusEmoji = '⭐';
                  } else if (isIntroduced) {
                    bgColor = 'bg-ocean-400/20';
                    labelColor = 'text-ocean-200';
                    statusEmoji = '🔵';
                  }

                  return (
                    <div
                      key={sound}
                      className={`rounded-xl ${bgColor} px-3 py-4 text-center`}
                    >
                      <p className={`font-quest text-3xl uppercase ${labelColor}`}>{sound}</p>
                      <p className="text-lg mt-1">{statusEmoji}</p>
                      {accuracy !== null && (
                        <p className="font-body text-xs text-ocean-400 mt-1">{accuracy}%</p>
                      )}
                      {mastery?.retryCount ? (
                        <p className="font-body text-xs text-ocean-500 mt-0.5">
                          {mastery.retryCount} retry{mastery.retryCount !== 1 ? 's' : ''}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-4 flex-wrap">
              <span className="font-body text-xs text-pearl-500">⬜ Not started</span>
              <span className="font-body text-xs text-ocean-300">🔵 Introduced ({introducedSounds.length}/{SATPIN_SOUNDS.length})</span>
              <span className="font-body text-xs text-seafoam-400">⭐ Mastered ({masteredSounds.length}/{SATPIN_SOUNDS.length})</span>
            </div>
          </CardBody>
        </Card>

        {/* CVC Words Unlocked (issue #111) */}
        {unlockedCvcWords.length > 0 && (
          <Card variant="glass" className="mb-8">
            <CardHeader>
              <CardTitle>🔤 CVC Words Unlocked ({unlockedCvcWords.length})</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="font-body text-pearl-400 text-sm mb-3">
                Words your child can now build from their mastered sounds:
              </p>
              <div className="flex flex-wrap gap-2">
                {unlockedCvcWords.map((word) => (
                  <span
                    key={word}
                    className="font-quest text-ocean-200 bg-ocean-700/40 rounded-lg px-3 py-1 text-sm uppercase tracking-wide"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Weak phonics recommendations (issue #112) */}
        {weakSoundRecommendations.length > 0 && (
          <Card variant="default" className="mb-8">
            <CardHeader>
              <CardTitle>🎯 Phonics Reinforcement Needed</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="font-body text-pearl-400 text-sm mb-4">
                These sounds need extra practice. The suggested activities will help reinforce them.
              </p>
              <div className="flex flex-col gap-3">
                {weakSoundRecommendations.map(({ sound, activity }) => {
                  const m = phonicsMastery[sound];
                  const accuracy = m && m.attemptCount > 0
                    ? Math.round((m.correctCount / m.attemptCount) * 100)
                    : 0;
                  return (
                    <div key={sound} className="flex items-center justify-between">
                      <div>
                        <p className="font-quest text-pearl-200 uppercase">
                          /{sound}/ sound — {accuracy}% accuracy
                        </p>
                        <p className="font-body text-xs text-ocean-400">
                          Suggested: {activity.title}
                        </p>
                      </div>
                      <Link to={`/reading/${activity.id}`}>
                        <Button variant="coral" size="sm">
                          Practice
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </CardBody>
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

        {/* Repeat Recommendations (zone-level) */}
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

        {/* Session History (issue #110) */}
        {sessionHistory.length > 0 && (
          <Card variant="glass" className="mb-8">
            <CardHeader>
              <CardTitle>📖 Session History</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-white/10">
                {[...sessionHistory].reverse().slice(0, 10).map((record) => (
                  <div key={record.sessionId} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-quest text-pearl-200">
                        Level {record.phonicsLevel} Session
                        {' '}
                        <span className="font-body text-xs text-ocean-400">
                          ({record.activityIds.length} activit{record.activityIds.length === 1 ? 'y' : 'ies'})
                        </span>
                      </p>
                      <p className="font-body text-xs text-ocean-400">
                        {new Date(record.completedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <p className="font-quest text-ocean-200 text-sm">+{record.pearlsEarned} 🪙</p>
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
