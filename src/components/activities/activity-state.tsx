import Link from "next/link";
export function ActivityProblem({ message }: { message: string }) { return <section role="alert" className="space-y-4 rounded-lg border border-base-300 p-6"><h1 className="text-xl font-bold">Activities could not be loaded</h1><p>{message}</p><Link href="/activities" className="btn btn-outline">Return to activities</Link></section>; }
