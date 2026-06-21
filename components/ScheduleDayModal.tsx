"use client";

import React, { useRef } from "react";

interface ScheduleDayModalProps {
  day: { name: string; type: string; label: string };
  data: any;
  setData: (data: any) => void;
  saveDailyChanges: (data: any) => void;
  reflectionText: string;
  setReflectionText: (text: string) => void;
  saveReflectionChanges: (text: string) => void;
  onClose: () => void;
  updateAppState: (state: any) => Promise<any>;
}

export default function ScheduleDayModal({
  day,
  data,
  setData,
  saveDailyChanges,
  reflectionText,
  setReflectionText,
  saveReflectionChanges,
  onClose,
  updateAppState
}: ScheduleDayModalProps) {
  const getFullLabel = (type: string) => {
    switch (type) {
      case "math":
        return "Mathematics Focus";
      case "leetcode":
        return "LeetCode & DOD (Data Oriented Design) Focus";
      case "implementation":
        return "Custom Data Structure Implementation";
      case "reflection":
        return "Weekly Reflection";
      default:
        return "Daily Focus";
    }
  };

  const color = "var(--accent)";

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
          gap: "1.5rem",
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
            {day.name} Schedule
          </span>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", marginTop: "0.5rem" }}>
            {getFullLabel(day.type)}
          </h2>
        </div>

        {/* Modal Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Daily Revision and Focus Checklist Editors inside Modal */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "550px", overflowY: "auto", paddingRight: "0.25rem" }}>
              
              {/* Today's Revision Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <strong style={{ color: color, fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  TODAY'S REVISION CHECKLIST:
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
                          checked={item.completed}
                          onChange={(e) => {
                            const updatedItems = (data.dailyRevisionItems?.[day.name] || []).map((it: any) => {
                              if (it.id === item.id) {
                                  return { ...it, completed: e.target.checked };
                              }
                              return it;
                            });

                            // Sync streak history if editing the actual today's day
                            const today = new Date();
                            const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                            const todayKey = DAYS_SHORT_MAP[today.getDay()];
                            let newStreakHistory = [...(data.streakHistory || [])];
                            let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };

                            if (day.name === todayKey) {
                              const year = today.getFullYear();
                              const month = String(today.getMonth() + 1).padStart(2, '0');
                              const dateVal = String(today.getDate()).padStart(2, '0');
                              const todayStr = `${year}-${month}-${dateVal}`;

                              const todayItems = newCompletedItemsHistory[todayStr] || [];
                              if (e.target.checked) {
                                newStreakHistory.push(todayStr);
                                const alreadyExists = todayItems.some((it: any) => (typeof it === 'string' ? it === item.title : it.title === item.title));
                                if (!alreadyExists) {
                                  newCompletedItemsHistory[todayStr] = [...todayItems, { title: item.title, description: item.description || "" }];
                                }
                              } else {
                                const index = newStreakHistory.indexOf(todayStr);
                                if (index > -1) {
                                  newStreakHistory.splice(index, 1);
                                }
                                newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== item.title : it.title !== item.title));
                              }
                            }

                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              },
                              streakHistory: newStreakHistory,
                              completedItemsHistory: newCompletedItemsHistory
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

                            // Sync streak history if editing the actual today's day
                            const today = new Date();
                            const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                            const todayKey = DAYS_SHORT_MAP[today.getDay()];
                            let newStreakHistory = [...(data.streakHistory || [])];
                            let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };

                            if (day.name === todayKey) {
                              const year = today.getFullYear();
                              const month = String(today.getMonth() + 1).padStart(2, '0');
                              const dateVal = String(today.getDate()).padStart(2, '0');
                              const todayStr = `${year}-${month}-${dateVal}`;

                              if (item.completed) {
                                const index = newStreakHistory.indexOf(todayStr);
                                if (index > -1) {
                                  newStreakHistory.splice(index, 1);
                                }
                                const todayItems = newCompletedItemsHistory[todayStr] || [];
                                newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== item.title : it.title !== item.title));
                              }
                            }

                            const newData = {
                              ...data,
                              dailyRevisionItems: {
                                ...(data.dailyRevisionItems || {}),
                                [day.name]: updatedItems
                              },
                              streakHistory: newStreakHistory,
                              completedItemsHistory: newCompletedItemsHistory
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
                <strong style={{ color: color, fontSize: "0.75rem", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  TODAY'S FOCUS CHECKLIST:
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
                        checked={task.completed}
                        onChange={(e) => {
                          const updatedTasks = (data.dailyTasks?.[day.name] || []).map((t: any) => {
                            if (t.id === task.id) {
                              return { ...t, completed: e.target.checked };
                            }
                            return t;
                          });
                          
                          // Sync streak history if editing the actual today's day
                          const today = new Date();
                          const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          const todayKey = DAYS_SHORT_MAP[today.getDay()];
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          
                          if (day.name === todayKey) {
                            const year = today.getFullYear();
                            const month = String(today.getMonth() + 1).padStart(2, '0');
                            const dateVal = String(today.getDate()).padStart(2, '0');
                            const todayStr = `${year}-${month}-${dateVal}`;
                            
                            const todayItems = newCompletedItemsHistory[todayStr] || [];
                            if (e.target.checked) {
                              newStreakHistory.push(todayStr);
                              const alreadyExists = todayItems.some((it: any) => (typeof it === 'string' ? it === task.title : it.title === task.title));
                              if (!alreadyExists) {
                                newCompletedItemsHistory[todayStr] = [...todayItems, { title: task.title }];
                              }
                            } else {
                              const index = newStreakHistory.indexOf(todayStr);
                              if (index > -1) {
                                newStreakHistory.splice(index, 1);
                              }
                              newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== task.title : it.title !== task.title));
                            }
                          }
                          
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory
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
                          
                          // Sync streak history if editing the actual today's day
                          const today = new Date();
                          const DAYS_SHORT_MAP = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                          const todayKey = DAYS_SHORT_MAP[today.getDay()];
                          let newStreakHistory = [...(data.streakHistory || [])];
                          let newCompletedItemsHistory = { ...(data.completedItemsHistory || {}) };
                          
                          if (day.name === todayKey) {
                            const year = today.getFullYear();
                            const month = String(today.getMonth() + 1).padStart(2, '0');
                            const dateVal = String(today.getDate()).padStart(2, '0');
                            const todayStr = `${year}-${month}-${dateVal}`;
                            
                            if (task.completed) {
                              const index = newStreakHistory.indexOf(todayStr);
                              if (index > -1) {
                                newStreakHistory.splice(index, 1);
                              }
                              const todayItems = newCompletedItemsHistory[todayStr] || [];
                              newCompletedItemsHistory[todayStr] = todayItems.filter((it: any) => (typeof it === 'string' ? it !== task.title : it.title !== task.title));
                            }
                          }
                          
                          const newData = {
                            ...data,
                            dailyTasks: {
                              ...(data.dailyTasks || {}),
                              [day.name]: updatedTasks
                            },
                            streakHistory: newStreakHistory,
                            completedItemsHistory: newCompletedItemsHistory
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
