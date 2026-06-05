"use client";

import React from "react";

export default function StreakGraph({ streakHistory = [] }: { streakHistory?: string[] }) {
  // Count occurrences of each date
  const dateCounts: { [key: string]: number } = {};
  streakHistory.forEach((date) => {
    dateCounts[date] = (dateCounts[date] || 0) + 1;
  });

  // Calculate back 53 weeks (371 days) to fill the grid, aligned to Sunday
  const today = new Date();
  const daysToRender = 371;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysToRender + 1);

  // Align start date to Sunday
  const startDayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  const weeks: { dateStr: string; count: number }[][] = [];
  let currentWeek: { dateStr: string; count: number }[] = [];

  const tempDate = new Date(startDate);
  // Render up to today
  while (tempDate <= today) {
    const year = tempDate.getFullYear();
    const month = String(tempDate.getMonth() + 1).padStart(2, '0');
    const day = String(tempDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const count = dateCounts[dateStr] || 0;

    currentWeek.push({ dateStr, count });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Handle remaining days for current week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ dateStr: '', count: 0 });
    }
    weeks.push(currentWeek);
  }

  // Helper to color cells based on contribution level
  const getColorClass = (count: number) => {
    if (count === 0) return 'var(--streak-0)';
    if (count <= 1) return 'var(--streak-1)';
    if (count <= 2) return 'var(--streak-2)';
    if (count <= 3) return 'var(--streak-3)';
    return 'var(--streak-4)';
  };

  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <h2 className="section-title">Consistency Streak</h2>
      <div style={{ display: 'flex', gap: '4px', minWidth: '700px', padding: '10px 0' }}>
        {weeks.map((week, wIdx) => (
          <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {week.map((day, dIdx) => (
              <div 
                key={dIdx} 
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: day.dateStr ? getColorClass(day.count) : 'transparent',
                  transition: 'background-color 0.3s ease',
                }}
                title={day.dateStr ? `${day.dateStr}: ${day.count} update${day.count !== 1 ? 's' : ''}` : ''}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
