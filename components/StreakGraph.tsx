"use client";

import React, { useEffect, useRef, useState } from "react";

export default function StreakGraph({ 
  streakHistory = [], 
  completedItemsHistory = {},
  startDate
}: { 
  streakHistory?: string[]; 
  completedItemsHistory?: { [date: string]: any[] };
  startDate?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDateDetails, setSelectedDateDetails] = useState<string | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [streakHistory]);

  // Count occurrences of each date
  const dateCounts: { [key: string]: number } = {};
  streakHistory.forEach((date) => {
    dateCounts[date] = (dateCounts[date] || 0) + 1;
  });

  const today = new Date();
  let startDateObj: Date;

  if (startDate) {
    const parts = startDate.split("-");
    startDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    // Fallback: 53 weeks ago if startDate not provided
    startDateObj = new Date(today);
    startDateObj.setDate(today.getDate() - 370);
  }
  startDateObj.setHours(0, 0, 0, 0);

  // Align start date to Sunday (so weeks represent Sun-Sat rows)
  const startDayOfWeek = startDateObj.getDay();
  startDateObj.setDate(startDateObj.getDate() - startDayOfWeek);

  const weeks: { dateStr: string; count: number }[][] = [];
  let currentWeek: { dateStr: string; count: number }[] = [];

  const tempDate = new Date(startDateObj);
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
    <div 
      ref={scrollContainerRef}
      className="glass-panel" 
      style={{ overflowX: 'auto' }}
    >
      <h2 className="section-title">Consistency Streak</h2>
      <div style={{ display: 'flex', gap: '4px', padding: '10px 0' }}>
        {weeks.map((week, wIdx) => (
          <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {week.map((day, dIdx) => (
              <div 
                key={dIdx} 
                onClick={() => day.dateStr && setSelectedDateDetails(day.dateStr)}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: day.dateStr ? getColorClass(day.count) : 'transparent',
                  transition: 'background-color 0.3s ease',
                  cursor: day.dateStr ? 'pointer' : 'default'
                }}
                title={
                  day.dateStr 
                    ? `${day.dateStr}: ${day.count} update${day.count !== 1 ? 's' : ''}${
                        completedItemsHistory[day.dateStr] && completedItemsHistory[day.dateStr].length > 0
                          ? `\nAccomplished:\n• ${completedItemsHistory[day.dateStr]
                              .map((it: any) => {
                                const itemObj = typeof it === 'string' ? { title: it, description: "" } : it;
                                return itemObj.description 
                                  ? `${itemObj.title} (${itemObj.description})`
                                  : itemObj.title;
                              })
                              .join('\n• ')}`
                          : ''
                      }`
                    : ''
                }
              />
            ))}
          </div>
        ))}
      </div>

      {selectedDateDetails && (
        <div 
          onClick={() => setSelectedDateDetails(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "1.5rem",
              border: "1px solid var(--accent)",
              borderRadius: "8px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)"
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedDateDetails(null)}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                fontSize: "1.1rem",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div>
              <span style={{ 
                fontSize: "0.75rem", 
                background: "rgba(14, 165, 233, 0.1)", 
                color: "var(--accent)", 
                padding: "0.15rem 0.5rem", 
                borderRadius: "4px", 
                fontWeight: 600,
                fontFamily: "monospace",
                letterSpacing: "0.05em"
              }}>
                Streak Achievement
              </span>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem", marginBottom: 0 }}>
                Accomplished on {selectedDateDetails}
              </h3>
            </div>

            {/* Completed Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {completedItemsHistory[selectedDateDetails] && completedItemsHistory[selectedDateDetails].length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto" }}>
                  {completedItemsHistory[selectedDateDetails].map((it: any, idx: number) => {
                    const itemObj = typeof it === 'string' ? { title: it, description: "" } : it;
                    return (
                      <div 
                        key={idx}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                          background: "rgba(0, 0, 0, 0.15)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          width: "100%"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ color: "var(--accent)", fontSize: "0.95rem" }}>✓</span>
                          <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>{itemObj.title}</span>
                        </div>
                        {itemObj.description && (
                          <span style={{ fontSize: "0.75rem", color: "#71717a", marginLeft: "1.65rem" }}>
                            {itemObj.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#71717a", fontSize: "0.85rem", fontStyle: "italic", margin: 0, textAlign: "center", padding: "1rem 0" }}>
                  No accomplishments recorded on this day.
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setSelectedDateDetails(null)} 
                className="btn"
                style={{ padding: "0.4rem 1.25rem", fontSize: "0.8rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
