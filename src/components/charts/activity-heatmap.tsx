'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DailyActivity } from '@/lib/claude-data/types';
import { format, parseISO, subWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';

interface ActivityHeatmapProps {
  data: DailyActivity[];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const activityMap = new Map(data.map(d => [d.date, d.messageCount]));
  const maxMessages = Math.max(...data.map(d => d.messageCount), 1);

  const today = new Date();
  const startDate = startOfWeek(subWeeks(today, 23), { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let currentDate = startDate;
  for (let w = 0; w < 24; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }
    weeks.push(week);
  }

  function getIntensity(count: number): string {
    if (count === 0) return 'bg-secondary';
    const ratio = count / maxMessages;
    if (ratio < 0.25) return 'bg-primary/20';
    if (ratio < 0.5) return 'bg-primary/40';
    if (ratio < 0.75) return 'bg-primary/70';
    return 'bg-primary';
  }

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 pr-1.5 pt-0">
            {dayLabels.map((label, i) => (
              <div key={i} className="flex h-[13px] items-center">
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const count = activityMap.get(dateStr) || 0;
                  const isFuture = day > today;
                  return (
                    <Tooltip key={di}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-[13px] w-[13px] rounded-sm ${
                            isFuture ? 'bg-transparent' : getIntensity(count)
                          } transition-colors`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">{format(day, 'MMM d, yyyy')}</p>
                        <p className="text-muted-foreground">{count} messages</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-muted-foreground">Less</span>
          <div className="h-[10px] w-[10px] rounded-sm bg-secondary" />
          <div className="h-[10px] w-[10px] rounded-sm bg-primary/20" />
          <div className="h-[10px] w-[10px] rounded-sm bg-primary/40" />
          <div className="h-[10px] w-[10px] rounded-sm bg-primary/70" />
          <div className="h-[10px] w-[10px] rounded-sm bg-primary" />
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
