"use client";

import { useState } from "react";
import MethodBadge from "@/components/MethodBadge";
import { useApiHistory } from "@/context/ApiHistoryContext";
import { formatTime } from "@/lib/utils";

export default function ApiHistoryContent() {
  const { entries } = useApiHistory();
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="ca-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ca-table table-fixed">
            <colgroup>
              <col className="w-[80px]" />
              <col className="w-[260px]" />
              <col />
              <col className="w-[96px]" />
              <col className="w-[88px]" />
            </colgroup>
            <thead className="bg-[#F8FAFD]">
              <tr>
                <th className="ca-th">Method</th>
                <th className="ca-th">Endpoint</th>
                <th className="ca-th">Description</th>
                <th className="ca-th">Status</th>
                <th className="ca-th">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer border-t border-[#EDF1F7] hover:bg-[#F8FAFD]"
                  onClick={() => setSelected(entry)}
                >
                  <td className="ca-td">
                    <MethodBadge method={entry.method} />
                  </td>
                  <td className="ca-td truncate font-mono text-xs" title={entry.endpoint}>
                    {entry.endpoint}
                  </td>
                  <td className="ca-td truncate" title={entry.detail}>
                    {entry.detail}
                  </td>
                  <td className={`ca-td whitespace-nowrap font-semibold ${entry.status < 400 ? "text-[#058B3C]" : "text-[#C0392B]"}`}>
                    {entry.status < 400 ? `${entry.status} OK` : `${entry.status} FAIL`}
                  </td>
                  <td className="ca-td whitespace-nowrap">{formatTime(entry.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="ca-surface max-h-[90vh] w-full max-w-3xl overflow-y-auto p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="ca-section-title">API Call Details</h3>
              <button onClick={() => setSelected(null)} className="ca-button-secondary">
                Close
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Request Body</p>
                  <button
                    className="text-xs underline"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        selected.method === "GET" || selected.requestBody == null
                          ? ""
                          : JSON.stringify(selected.requestBody, null, 2)
                      )
                    }
                  >
                    Copy
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-[#F8FAFD] p-3 text-xs">
                  {selected.method === "GET" || selected.requestBody == null
                    ? ""
                    : JSON.stringify(selected.requestBody, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Response Body</p>
                  <button
                    className="text-xs underline"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(selected.responseBody || {}, null, 2))}
                  >
                    Copy
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-[#F8FAFD] p-3 text-xs">
                  {JSON.stringify(selected.responseBody, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
