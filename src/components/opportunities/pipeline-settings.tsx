"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Category, OpportunityOptions, Stage } from "@/features/opportunities/types";

export function PipelineSettings({ initial, manager }: { initial: OpportunityOptions; manager: boolean }) {
  const router = useRouter();
  const [options, setOptions] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function save(body: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/opportunities/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          `${result.error || "Configuration could not be saved."} ${Object.values(result.fields ?? {})
            .flat()
            .join(" ")}`,
        );
        return false;
      }
      setOptions(result);
      setMessage("Pipeline configuration saved.");
      router.refresh();
      return true;
    } catch {
      setError(
        "Configuration could not be saved. Refresh and try again. Example setup can be retried to add any missing entries.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>, entity: "stage" | "category", row?: Stage | Category) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    const shared = {
      name: String(data.get("name") ?? ""),
      active: data.has("active"),
      is_provisional: data.has("is_provisional"),
    };
    const values =
      entity === "stage"
        ? { ...shared, position: Number(data.get("position")), outcome: String(data.get("outcome")) }
        : { ...shared, code: String(data.get("code")) };
    if ((await save({ entity, ...(row ? { id: row.id } : {}), values })) && !row) form.reset();
  }
  function editor(entity: "stage" | "category", row?: Stage | Category) {
    const id = row?.id ?? `new-${entity}`,
      stage = row && "position" in row ? row : null,
      category = row && "code" in row ? row : null;
    return (
      <form onSubmit={event => submit(event, entity, row)} className="mt-4 space-y-4">
        <fieldset disabled={busy || !manager} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm" htmlFor={`${id}-name`}>
              Name
            </label>
            <input
              className="input input-bordered w-full"
              id={`${id}-name`}
              name="name"
              required
              maxLength={entity === "stage" ? 100 : 200}
              defaultValue={row?.name ?? ""}
            />
          </div>
          {entity === "stage" ? (
            <>
              <div>
                <label className="mb-1 block text-sm" htmlFor={`${id}-position`}>
                  Position (unique)
                </label>
                <input
                  className="input input-bordered w-full"
                  id={`${id}-position`}
                  name="position"
                  type="number"
                  required
                  min={0}
                  max={100000}
                  step={1}
                  defaultValue={stage?.position ?? Math.max(-1, ...options.stages.map(item => item.position)) + 1}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm" htmlFor={`${id}-outcome`}>
                  Outcome
                </label>
                <select
                  className="select select-bordered w-full"
                  id={`${id}-outcome`}
                  name="outcome"
                  defaultValue={stage?.outcome ?? "open"}
                >
                  <option value="open">Open</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="abandoned">Abandoned</option>
                  <option value="junk">Junk</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-sm" htmlFor={`${id}-code`}>
                Code (uppercase, digits, underscore)
              </label>
              <input
                className="input input-bordered w-full"
                id={`${id}-code`}
                name="code"
                required
                maxLength={50}
                pattern="[A-Z][A-Z0-9_]*"
                defaultValue={category?.code ?? ""}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                className="checkbox checkbox-sm"
                type="checkbox"
                name="active"
                defaultChecked={row?.active ?? true}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="checkbox checkbox-sm"
                type="checkbox"
                name="is_provisional"
                defaultChecked={row?.is_provisional ?? true}
              />
              Provisional
            </label>
          </div>
          {manager && (
            <button className="btn btn-primary btn-sm w-fit" disabled={busy}>
              {row ? "Save" : `Add ${entity}`}
            </button>
          )}
        </fieldset>
      </form>
    );
  }
  return (
    <div className="max-w-4xl space-y-7">
      <p className="rounded-lg bg-info/10 p-4 text-sm">
        The assessment’s original stages are provisional. Configure labels and ordering with PSE. Contribution
        categories are separate from target verticals. Deactivate unused entries to retain historical records.
      </p>
      {!manager && <p className="text-sm">You can view this configuration. An authorized manager can change it.</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 p-4 text-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-success/10 p-4 text-success">
          {message}
        </p>
      )}
      {manager && (
        <section className="space-y-3 rounded-lg border border-base-300 p-5">
          <h2 className="font-semibold">Optional assessment examples</h2>
          <p className="text-sm text-base-content/65">
            Add missing original stage/category examples, marked provisional. Existing entries are kept. Final labels
            still need confirmation.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() => save({ entity: "starter" })}
          >
            Load provisional assessment examples
          </button>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Stages</h2>
        <div className="space-y-3">
          {options.stages.map(stage => (
            <details key={`${stage.id}:${stage.updated_at}`} className="rounded-lg border border-base-300 p-4">
              <summary className="cursor-pointer font-medium">
                {stage.position}. {stage.name} · {stage.outcome ?? "open"}
                {!stage.active && " · inactive"}
                {stage.is_provisional && " · provisional"}
              </summary>
              {editor("stage", stage)}
            </details>
          ))}
          {manager && (
            <details className="rounded-lg border border-base-300 p-4">
              <summary className="cursor-pointer font-medium">Add a stage</summary>
              {editor("stage")}
            </details>
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Contribution categories</h2>
        <div className="space-y-3">
          {options.categories.map(category => (
            <details key={`${category.id}:${category.updated_at}`} className="rounded-lg border border-base-300 p-4">
              <summary className="cursor-pointer font-medium">
                {category.code} · {category.name}
                {!category.active && " · inactive"}
                {category.is_provisional && " · provisional"}
              </summary>
              {editor("category", category)}
            </details>
          ))}
          {manager && (
            <details className="rounded-lg border border-base-300 p-4">
              <summary className="cursor-pointer font-medium">Add a category</summary>
              {editor("category")}
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
