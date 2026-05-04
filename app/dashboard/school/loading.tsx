// app/dashboard/school/loading.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FarmerDashboardLoading() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Sidebar Skeleton */}
      <div className="w-64 bg-emerald-800 flex-shrink-0">
        <Skeleton className="h-full w-full opacity-30" />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Skeleton */}
        <div className="h-16 bg-white border-b flex items-center px-6 gap-4">
          <Skeleton className="h-5 w-40" />
          <div className="ml-auto flex gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <Skeleton className="h-4 w-56" />

            {/* Page title */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-40" />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-0 shadow-lg overflow-hidden">
                  <CardContent className="p-5">
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Map + Crop chart row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-lg overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="p-0">
                  <Skeleton className="h-[420px] w-full rounded-none" />
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Farmers Table */}
            <Card className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-6 gap-4 pb-2 border-b border-gray-100">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-4" />
                    ))}
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4">
                      {[...Array(6)].map((_, j) => (
                        <Skeleton key={j} className="h-8 rounded" />
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
