import { useApi } from "../hooks/useApi.ts";

interface AppManifest {
  name: string;
  version: string;
  description: string;
  icon?: string;
  permissions?: string[];
}

interface AppsResponse {
  apps: AppManifest[];
}

const PERMISSION_COLORS: Record<string, string> = {
  docker: "bg-blue-500/20 text-blue-300",
  storage: "bg-green-500/20 text-green-300",
  network: "bg-yellow-500/20 text-yellow-300",
  ai: "bg-purple-500/20 text-purple-300",
  email: "bg-orange-500/20 text-orange-300",
  system: "bg-red-500/20 text-red-300",
};

export default function Apps() {
  const { data, loading, error } = useApi<AppsResponse>("/apps");

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Apps</h1>
        <p className="text-ark-text-dim mt-1">Installed modules running on your Ark</p>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-ark-card rounded-2xl p-6 border border-ark-border animate-pulse2 h-24" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-300">
          Failed to load apps: {error}
        </div>
      )}

      {data && (
        <>
          <div className="space-y-4 mb-8">
            {data.apps.length === 0 ? (
              <div className="text-center py-16 text-ark-muted">
                <div className="text-4xl mb-3">⊞</div>
                <p>No modules installed yet</p>
              </div>
            ) : (
              data.apps.map((app) => (
                <div
                  key={app.name}
                  className="bg-ark-card border border-ark-border rounded-2xl p-6 hover:border-ark-accent/30 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{app.icon ?? "⊞"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{app.name}</span>
                        <span className="text-xs text-ark-muted bg-ark-surface px-2 py-0.5 rounded-full">
                          v{app.version}
                        </span>
                      </div>
                      <p className="text-sm text-ark-text-dim mt-1">{app.description}</p>
                      {app.permissions && app.permissions.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-3">
                          {app.permissions.map((perm) => (
                            <span
                              key={perm}
                              className={`text-xs px-2 py-0.5 rounded-full ${PERMISSION_COLORS[perm] ?? "bg-ark-surface text-ark-muted"}`}
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Marketplace placeholder */}
          <div className="border border-dashed border-ark-border rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">🏪</div>
            <div className="font-medium mb-1">Ark Marketplace</div>
            <div className="text-sm text-ark-muted mb-4">
              Browse and install community modules — coming soon
            </div>
            <button disabled className="px-6 py-2 rounded-xl bg-ark-accent/20 text-ark-accent/50 text-sm cursor-not-allowed">
              Explore Modules
            </button>
          </div>
        </>
      )}
    </div>
  );
}
