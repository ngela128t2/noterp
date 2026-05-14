export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  )
}
