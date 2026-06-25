import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllReviews, deleteReview, setReviewHidden } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const list = useServerFn(listAllReviews);
  const del = useServerFn(deleteReview);
  const hide = useServerFn(setReviewHidden);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => list() });

  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Reviews</h1><p className="text-sm text-muted-foreground">All customer reviews. Hide moderates without losing the record; delete is permanent.</p></div>
      <div className="space-y-3">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {(data ?? []).map((r: any) => (
          <div key={r.id} className={`rounded-2xl border bg-surface p-4 ${r.hidden_at ? "border-amber-500/40 opacity-70" : "border-hairline"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  {r.hidden_at && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">HIDDEN</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{r.shops?.name_en ?? "—"} · {r.barbers?.display_name_en ?? "—"}</div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={async () => { await hide({ data: { id: r.id, hidden: !r.hidden_at } }); refetch(); }} className="rounded-lg border border-hairline px-2 py-1 text-xs">{r.hidden_at ? "Restore" : "Hide"}</button>
                <button onClick={async () => { if (confirm("Delete permanently?")) { await del({ data: { id: r.id } }); refetch(); } }} className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No reviews yet.</div>}
      </div>
    </div>
  );
}
