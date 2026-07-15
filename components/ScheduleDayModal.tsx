"use client";

import React, { useRef, useState } from "react";

interface ScheduleDayModalProps {
  day: { name: string; type: string; label: string };
  data: any;
  setData: (data: any) => void;
  saveDailyChanges: (data: any) => void;
  onClose: () => void;
  updateAppState: (state: any) => Promise<any>;
  weekOffset?: number;
}

const DEFAULT_WEEK_SCHEDULE = [
  { name: "Mon", type: "math", label: "Math" },
  { name: "Tue", type: "dsapattern", label: "DSA Pattern" },
  { name: "Wed", type: "math", label: "Math" },
  { name: "Thu", type: "dsapattern", label: "DSA Pattern" },
  { name: "Fri", type: "math", label: "Math" },
  { name: "Sat", type: "implementation", label: "DS Implementation" },
  { name: "Sun", type: "free", label: "Free" }
];

export default function ScheduleDayModal({
  day,
  data,
  setData,
  saveDailyChanges,
  onClose,
  updateAppState,
  weekOffset = 0
}: ScheduleDayModalProps) {
  const [showManager, setShowManager] = useState(false);

  const focusTypes = data.focusTypes || {
    math: { label: "Math", color: "#a78bfa" },
    dsapattern: { label: "DSA Pattern", color: "#34d399" },
    dsapractice: { label: "DSA Practice", color: "#22d3ee" },
    implementation: { label: "DS Implementation", color: "#fbbf24" },
    free: { label: "Free", color: "#a1a1aa" },
  };

  const currentDaySchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).find((d: any) => d.name === day.name) || day;

  const getFullLabel = (type: string) => {
    return focusTypes[type]?.label || type || "Daily Focus";
  };

  const color = "var(--accent)";

  // Compute the actual calendar date string for this day name (with week offset)
  const getDateForDay = (dayName: string): string => {
    const dayNameToIndex: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const targetDayIndex = dayNameToIndex[dayName] ?? 0;
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const diff = targetDayIndex === 0 ? 6 : targetDayIndex - 1;
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + diff);
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const targetDateStr = getDateForDay(day.name);
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  const isTargetToday = targetDateStr === todayStr;

  return (
    <div 
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
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
          maxWidth: "500px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          padding: "2rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
          border: `1px solid ${color}`,
          position: "relative",
          borderRadius: "8px"
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "1.5rem",
            background: "transparent",
            border: "none",
            color: "#a1a1aa",
            fontSize: "1.2rem",
            cursor: "pointer",
            fontFamily: "inherit"
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <span style={{ 
            fontSize: "0.75rem", 
            background: `${color}1a`, 
            color: color, 
            padding: "0.15rem 0.5rem", 
            borderRadius: "4px", 
            fontWeight: 600,
            textTransform: "uppercase",
            fontFamily: "monospace",
            letterSpacing: "0.05em"
          }}>
            {day.name} Schedule • {targetDateStr}
          </span>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem" }}>
            {getFullLabel(currentDaySchedule.type)}
          </h2>
        </div>

        {/* Dynamic Focus Selection & Management */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#a1a1aa" }}>Focus Type:</span>
              <select
                value={currentDaySchedule.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const newLabel = focusTypes[newType]?.label || newType;
                  const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d: any) => {
                    if (d.name === day.name) {
                      return { ...d, type: newType, label: newLabel };
                    }
                    return d;
                  });
                  const newData = {
                    ...data,
                    weekSchedule: updatedSchedule
                  };
                  setData(newData);
                  saveDailyChanges(newData);
                }}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "0.3rem 0.5rem",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {Object.entries(focusTypes).map(([key, val]: [string, any]) => (
                  <option key={key} value={key} style={{ background: "#18181b", color: "#fff" }}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowManager(!showManager)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontSize: "0.75rem",
                cursor: "pointer",
                fontFamily: "monospace",
                padding: 0,
                textDecoration: "underline"
              }}
            >
              {showManager ? "Hide Settings" : "Customize Pool"}
            </button>
          </div>

          {showManager && (
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              padding: "0.8rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem"
            }}>
              <span style={{ fontSize: "0.7rem", color: "#a1a1aa", fontWeight: "bold", textTransform: "uppercase" }}>
                Edit Focus Types Pool
              </span>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", paddingRight: "0.25rem" }}>
                {Object.entries(focusTypes).map(([key, val]: [string, any]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="text"
                      value={val.label}
                      onChange={(e) => {
                        const updatedTypes = {
                          ...focusTypes,
                          [key]: { ...val, label: e.target.value }
                        };
                        
                        const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d: any) => {
                          if (d.type === key) {
                            return { ...d, label: e.target.value };
                          }
                          return d;
                        });

                        const newData = {
                          ...data,
                          focusTypes: updatedTypes,
                          weekSchedule: updatedSchedule
                        };
                        setData(newData);
                        saveDailyChanges(newData);
                      }}
                      placeholder="Label"
                      style={{
                        flex: 1,
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "4px",
                        padding: "0.2rem 0.4rem",
                        color: "#fff",
                        fontSize: "0.75rem",
                        outline: "none"
                      }}
                    />

                    <input
                      type="color"
                      value={val.color || "#a1a1aa"}
                      onChange={(e) => {
                        const updatedTypes = {
                          ...focusTypes,
                          [key]: { ...val, color: e.target.value }
                        };
                        const newData = {
                          ...data,
                          focusTypes: updatedTypes
                        };
                        setData(newData);
                        saveDailyChanges(newData);
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0
                      }}
                    />

                    <button
                      onClick={() => {
                        const updatedTypes = { ...focusTypes };
                        delete updatedTypes[key];

                        const fallbackType = Object.keys(updatedTypes)[0] || "free";
                        const fallbackLabel = updatedTypes[fallbackType]?.label || "Free";
                        
                        const updatedSchedule = (data.weekSchedule || DEFAULT_WEEK_SCHEDULE).map((d: any) => {
                          if (d.type === key) {
                            return { ...d, type: fallbackType, label: fallbackLabel };
                          }
                          return d;
                        });

                        const newData = {
                          ...data,
                          focusTypes: updatedTypes,
                          weekSchedule: updatedSchedule
                        };
                        setData(newData);
                        saveDailyChanges(newData);
                      }}
                      disabled={Object.keys(focusTypes).length <= 1}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: Object.keys(focusTypes).length <= 1 ? "#3f3f46" : "#ef4444",
                        cursor: Object.keys(focusTypes).length <= 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        padding: "0 0.2rem"
                      }}
                      title="Delete Focus Type"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "0.5rem" }}>
                <input
                  type="text"
                  id="new-type-label"
                  placeholder="New type label..."
                  style={{
                    flex: 1,
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "4px",
                    padding: "0.25rem 0.5rem",
                    color: "#fff",
                    fontSize: "0.75rem",
                    outline: "none"
                  }}
                />
                <input
                  type="color"
                  id="new-type-color"
                  defaultValue="#0ea5e9"
                  style={{
                    width: "24px",
                    height: "24px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0
                  }}
                />
                <button
                  onClick={() => {
                    const labelInput = document.getElementById("new-type-label") as HTMLInputElement;
                    const colorInput = document.getElementById("new-type-color") as HTMLInputElement;
                    if (labelInput && labelInput.value.trim()) {
                      const labelVal = labelInput.value.trim();
                      const colorVal = colorInput ? colorInput.value : "#0ea5e9";
                      const keyVal = labelVal.toLowerCase().replace(/[^a-z0-9]/g, "");
                      
                      if (keyVal && !focusTypes[keyVal]) {
                        const updatedTypes = {
                          ...focusTypes,
                          [keyVal]: { label: labelVal, color: colorVal }
                        };
                        const newData = {
                          ...data,
                          focusTypes: updatedTypes
                        };
                        setData(newData);
                        saveDailyChanges(newData);
                        labelInput.value = "";
                      }
                    }
                  }}
                  className="btn"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                >
                  Add Type
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Daily Revision and Focus Checklist Editors inside Modal */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "550px", overflowY: "auto", paddingRight: "0.25rem" }}>
              
              {/* Today's Revision Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <strong style={{ color: color, fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {isTargetToday ? "TODAY'S " : ""}REVISION CHECKLIST:
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(data.dailyRevisionItems?.[day.name] || []).map((item: any, index: number) => (
                    <div 
                      key={item.id || index} 
                      style={{ 
                        display: "flex", 
                        flexDirection: "column",
                        gap: "0.4rem",
                        background: "rgba(0, 0, 0, 0.15)",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <input
                          type="checkbox"
                          className="checkbox-custom"
                          checked={isTargetToday ? item.completed : (data.weeklyCompletions?.[targetDateStr]?.revisions || []).includes(item.id)}
                          onChange={(e) => {
                            const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it: any) => {
                              if (it.id === item.id) {
                                  return { ...it, completed: e.target.checked };
                              }
                              return it;
                            });

                            // Sync streak history for the actual date of this day
                            const targetDateStr = getDateForDay(day.name);
                            let newStreakHistory = [...(data.streakHistory || [])];
                            let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                            let newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };

                            const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                            const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                            if (e.target.checked) {
                              newStreakHistory.push(targetDateStr);
                              const alreadyExists = dateItems.some((it: any) => (typeof it === 'string' ? it === item.title : it.title === item.title));
                              if (!alreadyExists) {
                                newCompletedItemsHistory[targetDateStr] = [...dateItems, { title: item.title, description: item.description || "" }];
                              }
                              if (!targetComps.revisions.includes(item.id)) {
                                targetComps.revisions = [...targetComps.revisions, item.id];
                              }
                            } else {
                              const index = newStreakHistory.indexOf(targetDateStr);
                              if (index > -1) {
                                newStreakHistory.splice(index, 1);
                              }
                              newCompletedItemsHistory[targetDateStr] = dateItems.filter((it: any) => (typeof it === 'string' ? it !== item.title : it.title !== item.title));
                              targetComps.revisions = targetComps.revisions.filter((id: string) => id !== item.id);
                            }
                            
                            newWeeklyCompletions[targetDateStr] = targetComps;

                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              },
                              streakHistory: newStreakHistory,
                              completedItemsHistory: newCompletedItemsHistory,
                              weeklyCompletions: newWeeklyCompletions
                            };
                            setData(newData);
                            saveDailyChanges(newData);
                          }}
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it: any) => {
                              if (it.id === item.id) {
                                return { ...it, title: e.target.value };
                              }
                              return it;
                            });
                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              }
                            };
                            setData(newData);
                            saveDailyChanges(newData);
                          }}
                          onBlur={async () => {
                            try {
                              await updateAppState(data);
                            } catch (err) {
                              console.error("Failed to save revision item title inside modal", err);
                            }
                          }}
                          placeholder="Revision topic..."
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            fontFamily: "inherit",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            outline: "none"
                          }}
                        />
                        <button
                          onClick={() => {
                            const updatedItems = (data.dailyRevisionItems?.[day.name] || []).filter((it: any) => it.id !== item.id);

                            // Sync streak history for the actual date of this day
                            const targetDateStr = getDateForDay(day.name);
                            let newStreakHistory = [...(data.streakHistory || [])];
                            let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                            let newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };
                            const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                            if (item.completed) {
                              const index = newStreakHistory.indexOf(targetDateStr);
                              if (index > -1) {
                                newStreakHistory.splice(index, 1);
                              }
                              const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                              newCompletedItemsHistory[targetDateStr] = dateItems.filter((it: any) => (typeof it === 'string' ? it !== item.title : it.title !== item.title));
                            }
                            
                            targetComps.revisions = targetComps.revisions.filter((id: string) => id !== item.id);
                            newWeeklyCompletions[targetDateStr] = targetComps;

                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              },
                              streakHistory: newStreakHistory,
                              completedItemsHistory: newCompletedItemsHistory,
                              weeklyCompletions: newWeeklyCompletions
                            };
                            setData(newData);
                            saveDailyChanges(newData);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "0.9rem"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      
                      {/* Description Field */}
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => {
                          const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it: any) => {
                            if (it.id === item.id) {
                              return { ...it, description: e.target.value };
                            }
                            return it;
                          });
                          const newData = {
                            ...data,
                            dailyRevisionItems: {
                              ...(data.dailyRevisionItems || {}),
                              [day.name]: updatedItems
                            }
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                        onBlur={async () => {
                          try {
                            await updateAppState(data);
                          } catch (err) {
                            console.error("Failed to save revision item description inside modal", err);
                          }
                        }}
                        placeholder="Topic description (optional)..."
                        style={{
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px dashed rgba(255, 255, 255, 0.1)",
                          color: "#a1a1aa",
                          fontFamily: "inherit",
                          fontSize: "0.8rem",
                          outline: "none",
                          padding: "0.1rem 0",
                          marginLeft: "1.75rem"
                        }}
                      />
                    </div>
                  ))}

                  {/* Add revision item form */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", background: "rgba(255, 255, 255, 0.02)", padding: "0.6rem", borderRadius: "6px", border: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                    <input
                      type="text"
                      id="new-rev-title"
                      placeholder="New revision topic..."
                      style={{
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "6px",
                        padding: "0.4rem 0.6rem",
                        color: "#e4e4e7",
                        fontFamily: "inherit",
                        fontSize: "0.8rem",
                        outline: "none"
                      }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        id="new-rev-desc"
                        placeholder="Topic description (optional)..."
                        style={{
                          flex: 1,
                          background: "rgba(0, 0, 0, 0.25)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "6px",
                          padding: "0.4rem 0.6rem",
                          color: "#e4e4e7",
                          fontFamily: "inherit",
                          fontSize: "0.8rem",
                          outline: "none"
                        }}
                      />
                      <button
                        onClick={() => {
                          const titleInput = document.getElementById("new-rev-title") as HTMLInputElement;
                          const descInput = document.getElementById("new-rev-desc") as HTMLInputElement;
                          if (titleInput && titleInput.value.trim()) {
                            const newItem = {
                              id: `rev_${Date.now()}`,
                              title: titleInput.value.trim(),
                              description: descInput ? descInput.value.trim() : "",
                              completed: false
                            };
                            const updatedItems = [...(data.dailyRevisionItems?.[day.name] || []), newItem];
                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              }
                            };
                            setData(newData);
                            saveDailyChanges(newData);
                            titleInput.value = "";
                            if (descInput) descInput.value = "";
                          }
                        }}
                        className="btn"
                        style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--card-border)", margin: "0.5rem 0" }} />

              {/* Today's Focus Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <strong style={{ color: color, fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {isTargetToday ? "TODAY'S " : ""}FOCUS CHECKLIST:
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(data.dailyTasks?.[day.name] || []).map((task: any, index: number) => (
                    <div 
                      key={task.id || index} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "0.75rem",
                        background: "rgba(0, 0, 0, 0.15)",
                        padding: "0.4rem 0.6rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={isTargetToday ? task.completed : (data.weeklyCompletions?.[targetDateStr]?.tasks || []).includes(task.id)}
                        onChange={(e) => {
                          const updatedTasks = (data.dailyTasks?.[day.name] || []).map((t: any) => {
                            if (t.id === task.id) {
                              return { ...t, completed: e.target.checked };
                            }
                            return t;
                          });
                          
                          // Sync streak history for the actual date of this day
                          const targetDateStr = getDateForDay(day.name);
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          let newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };

                          const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                          const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };
                          
                          if (e.target.checked) {
                            newStreakHistory.push(targetDateStr);
                            const alreadyExists = dateItems.some((it: any) => (typeof it === 'string' ? it === task.title : it.title === task.title));
                            if (!alreadyExists) {
                              newCompletedItemsHistory[targetDateStr] = [...dateItems, { title: task.title }];
                            }
                            if (!targetComps.tasks.includes(task.id)) {
                              targetComps.tasks = [...targetComps.tasks, task.id];
                            }
                          } else {
                            const index = newStreakHistory.indexOf(targetDateStr);
                            if (index > -1) {
                              newStreakHistory.splice(index, 1);
                            }
                            newCompletedItemsHistory[targetDateStr] = dateItems.filter((it: any) => (typeof it === 'string' ? it !== task.title : it.title !== task.title));
                            targetComps.tasks = targetComps.tasks.filter((id: string) => id !== task.id);
                          }
                          
                          newWeeklyCompletions[targetDateStr] = targetComps;
                          
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory,
                            weeklyCompletions: newWeeklyCompletions
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                      />
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const updatedTasks = (data.dailyTasks?.[day.name] || []).map((t: any) => {
                            if (t.id === task.id) {
                              return { ...t, title: e.target.value };
                            }
                            return t;
                          });
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            }
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                        onBlur={async () => {
                          try {
                            await updateAppState(data);
                          } catch (err) {
                            console.error("Failed to save daily task title inside modal", err);
                          }
                        }}
                        placeholder="Task description..."
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          color: "#fff",
                          fontFamily: "inherit",
                          fontSize: "0.85rem",
                          outline: "none"
                        }}
                      />
                      <button
                        onClick={() => {
                          const updatedTasks = (data.dailyTasks?.[day.name] || []).filter((t: any) => t.id !== task.id);
                          
                          // Sync streak history for the actual date of this day
                          const targetDateStr = getDateForDay(day.name);
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          let newWeeklyCompletions = { ...(data.weeklyCompletions || {}) };
                          const targetComps = newWeeklyCompletions[targetDateStr] || { tasks: [], revisions: [] };

                          if (task.completed) {
                            const index = newStreakHistory.indexOf(targetDateStr);
                            if (index > -1) {
                              newStreakHistory.splice(index, 1);
                            }
                            const dateItems = newCompletedItemsHistory[targetDateStr] || [];
                            newCompletedItemsHistory[targetDateStr] = dateItems.filter((it: any) => (typeof it === 'string' ? it !== task.title : it.title !== task.title));
                          }
                          
                          targetComps.tasks = targetComps.tasks.filter((id: string) => id !== task.id);
                          newWeeklyCompletions[targetDateStr] = targetComps;
                          
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory,
                            weeklyCompletions: newWeeklyCompletions
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "0.9rem"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  {/* Add task option inside modal */}
                  <div 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.75rem",
                      marginTop: "0.5rem"
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Add a focus item..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const newTask = {
                            id: `task_${Date.now()}`,
                            title: e.currentTarget.value.trim(),
                            completed: false
                          };
                          const updatedTasks = [...(data.dailyTasks?.[day.name] || []), newTask];
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            }
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                          e.currentTarget.value = "";
                        }
                      }}
                      style={{
                        flex: 1,
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "6px",
                        padding: "0.5rem 0.75rem",
                        color: "#e4e4e7",
                        fontFamily: "inherit",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input && input.value.trim()) {
                          const newTask = {
                            id: `task_${Date.now()}`,
                            title: input.value.trim(),
                            completed: false
                          };
                          const updatedTasks = [...(data.dailyTasks?.[day.name] || []), newTask];
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            }
                          };
                          setData(newData);
                          saveDailyChanges(newData);
                          input.value = "";
                        }
                      }}
                      className="btn"
                      style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Modal Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button onClick={onClose} className="btn" style={{ padding: "0.5rem 1.5rem", fontSize: "0.85rem" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
