export interface ActivityItem {
    readonly activityId: string;
    readonly correlationId: string | null;
    readonly type: string;
    readonly status: string;
    readonly startedAt: Date;
    readonly lastOccurredAt: Date;
    readonly fileName: string | null;
    readonly catalogItemId: number | null;
    readonly failureCode: string | null;
    readonly cursor: string | null;
    readonly category: string | null;
    readonly severity: string | null;
    readonly resourceType: string | null;
    readonly resourceId: string | null;
    readonly resourceTitle: string | null;
    readonly context: Record<string, unknown>;
}

export interface ActivityPage {
    readonly items: ActivityItem[];
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
}
