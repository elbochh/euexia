'use client';
import { useGameStore } from '@/stores/gameStore';
import ChecklistItem from './ChecklistItem';
import { motion } from 'framer-motion';

// Type for checklist items - matches the store's ChecklistItem interface
type ChecklistItemType = {
  _id: string;
  title: string;
  description: string;
  frequency: string;
  isCompleted: boolean;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
  unlockAt: string | null;
  nextDueAt: string | null;
  isLocked?: boolean;
  isOnCooldown?: boolean;
  isExpired?: boolean;
  isAvailable?: boolean;
  isFullyDone?: boolean;
  remainingSeconds?: number;
  completionProgress?: string | null;
  timeOfDay?: string;
  [key: string]: any;
};

/** Format date to show day name and date */
function formatDayHeader(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (dayDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (dayDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    const dayName = dayNames[date.getDay()];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${dayName}, ${month} ${day}`;
  }
}

/** Format time from date */
function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/** Group tasks by day based on unlockAt or nextDueAt */
function groupTasksByDay(tasks: ChecklistItemType[]): Map<string, ChecklistItemType[]> {
  const groups = new Map<string, ChecklistItemType[]>();
  
  tasks.forEach((task) => {
    // Use unlockAt for locked tasks, nextDueAt for cooldown tasks
    const dateStr = task.unlockAt || task.nextDueAt;
    if (!dateStr) return;
    
    const date = new Date(dateStr);
    const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
    }
    groups.get(dayKey)!.push(task);
  });
  
  // Sort tasks within each day by time
  groups.forEach((dayTasks, dayKey) => {
    dayTasks.sort((a, b) => {
      const dateA = new Date(a.unlockAt || a.nextDueAt || '');
      const dateB = new Date(b.unlockAt || b.nextDueAt || '');
      return dateA.getTime() - dateB.getTime();
    });
  });
  
  return groups;
}

export default function ChecklistView() {
  const { checklist, completeItem, isLoading } = useGameStore();

  // Separate items into groups based on their timing state
  const available = checklist.filter(
    (i) => i.isAvailable && !i.isCompleted && !i.isFullyDone
  );
  const lockedOrCooldown = checklist.filter(
    (i) => (i.isLocked || i.isOnCooldown) && !i.isFullyDone
  );
  const completedThisCycle = checklist.filter(
    (i) => i.isCompleted && !i.isFullyDone && !i.isOnCooldown && !i.isLocked
  );
  const fullyDone = checklist.filter((i) => i.isFullyDone);
  const expired = checklist.filter((i) => i.isExpired && !i.isFullyDone);

  // Group locked/cooldown tasks by day
  const lockedByDay = groupTasksByDay(lockedOrCooldown);
  const sortedDayKeys = Array.from(lockedByDay.keys()).sort();

  const totalDone = fullyDone.length + completedThisCycle.length;
  const progress =
    checklist.length > 0
      ? Math.round((totalDone / checklist.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-4xl"
        >
          ⚡
        </motion.div>
      </div>
    );
  }

  if (checklist.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold mb-2">No Tasks Yet</h3>
        <p className="text-gray-400 text-sm">
          Upload your consultation data to get your personalized health checklist!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress Bar */}
      <div className="game-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Quest Progress</span>
          <span className="text-sm text-blue-300">
            {totalDone}/{checklist.length}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #4ade80, #22c55e)',
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="text-center mt-1 text-xs text-gray-500">{progress}% Complete</div>
      </div>

      {/* Available Now */}
      {available.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-blue-300 mb-3 px-1">
            ⚔️ Available Now ({available.length})
          </h3>
          {available.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Locked / On Cooldown - Grouped by Day */}
      {lockedOrCooldown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-orange-300 mb-3 px-1">
            ⏳ Coming Up ({lockedOrCooldown.length})
          </h3>
          {sortedDayKeys.map((dayKey) => {
            const dayTasks = lockedByDay.get(dayKey)!;
            const firstTask = dayTasks[0];
            const taskDate = new Date(firstTask.unlockAt || firstTask.nextDueAt || '');
            const dayHeader = formatDayHeader(taskDate);
            
            return (
              <div key={dayKey} className="mb-4">
                {/* Day Header */}
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <span className="text-orange-300 text-xs font-semibold">
                    📅 {dayHeader}
                  </span>
                </div>
                
                {/* Tasks for this day */}
                {dayTasks.map((item, i) => {
                  const itemDate = new Date(item.unlockAt || item.nextDueAt || '');
                  const timeStr = formatTime(itemDate);
                  
                  return (
                    <div key={item._id} className="ml-4 mb-2">
                      <div className="text-xs text-gray-500 mb-1 px-2">
                        {timeStr}
                      </div>
                      <ChecklistItem
                        item={item}
                        index={i}
                        onComplete={completeItem}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed this cycle (recurring items that are done for now) */}
      {completedThisCycle.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-green-300 mb-3 px-1">
            ✅ Done for Now ({completedThisCycle.length})
          </h3>
          {completedThisCycle.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Fully Completed */}
      {fullyDone.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-emerald-300 mb-3 px-1">
            ★ Fully Completed ({fullyDone.length})
          </h3>
          {fullyDone.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-300 mb-3 px-1">
            ⛔ Expired ({expired.length})
          </h3>
          {expired.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
