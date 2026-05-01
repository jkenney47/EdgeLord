import { useEffect, useState } from "react";

import { useAppStore } from "../store/useAppStore";
import type { Session } from "../api/client";

function sessionLabel(session: Session): string {
  return `${session.name} ${session.startTime.slice(0, 10)}`;
}

export function SessionPanel() {
  const activeSession = useAppStore((state) => state.activeSession);
  const sessions = useAppStore((state) => state.sessions);
  const sessionError = useAppStore((state) => state.sessionError);
  const loadSessions = useAppStore((state) => state.loadSessions);
  const startSession = useAppStore((state) => state.startSession);
  const resumeSession = useAppStore((state) => state.resumeSession);
  const endActiveSession = useAppStore((state) => state.endActiveSession);
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const startNamedSession = async () => {
    await startSession({
      name: sessionName.trim() || undefined
    });
    setSessionName("");
  };

  return (
    <aside className="session-panel" aria-label="Session management">
      <details className="secondary-panel">
        <summary>
          <span>Session</span>
          <strong>{activeSession ? activeSession.name : "No active session"}</strong>
        </summary>
        <div className="secondary-panel-body">
          <div className="session-actions">
            <input
              aria-label="Session name"
              placeholder="Session name"
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
            />
            <button type="button" onClick={() => void startNamedSession()}>
              Start
            </button>
            <button type="button" disabled={!activeSession} onClick={() => void endActiveSession()}>
              End
            </button>
          </div>
          {sessionError ? <p className="capture-status error">{sessionError}</p> : null}
          <section className="session-list" aria-label="Past sessions">
            <div className="label-history-header">
              <span>Recent</span>
              <strong>{sessions.length}</strong>
            </div>
            {sessions.length === 0 ? (
              <p className="label-history-empty">No sessions yet</p>
            ) : (
              <ol>
                {sessions.slice(0, 5).map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      className={activeSession?.id === session.id ? "active" : undefined}
                      onClick={() => void resumeSession(session)}
                      aria-label={`Resume ${sessionLabel(session)}`}
                    >
                      <strong>{session.name}</strong>
                      <span>{session.startTime.slice(0, 10)}</span>
                      <span>{session.endTime ? "Closed" : "Open"}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </details>
    </aside>
  );
}
