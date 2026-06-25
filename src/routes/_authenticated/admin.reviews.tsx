import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllReviews, deleteReview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  const list = useServerFn(listAllReviews);
  const del = useServerFn(deleteReview);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => list() });

  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Reviews</h1><p className="text-sm text-muted-foreground">All customer reviews.</p></div>
      <div className="space-y-3">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {(data ?? []).map((r: any) => (
          <div key={r.id} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{r.shops?.name_en ?? "—"} · {r.barbers?.display_name_en ?? "—"}</div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
              </div>
              <button onClick={async () => { if (confirm("Delete review?")) { await del({ data: { id: r.id } }); refetch(); } }} className="text-xs text-red-400 hover:underline">Delete</button>
            </div>
          </div>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No reviews yet.</div>}
      </div>
    </div>
  );
}
