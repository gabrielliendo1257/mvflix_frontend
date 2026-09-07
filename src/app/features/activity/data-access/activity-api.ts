import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-base-url';
import { ActivityItem, ActivityPage } from '@features/activity/models/activity';

interface ActivityItemWire extends Omit<ActivityItem, 'startedAt' | 'lastOccurredAt'> {
    startedAt: string;
    lastOccurredAt: string;
}

interface ActivityPageWire {
    items: ActivityItemWire[];
    nextCursor: string | null;
    hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class ActivityApi {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(API_BASE_URL);

    get(cursor: string | null = null, limit = 20): Observable<ActivityPage> {
        let params = new HttpParams().set('limit', limit);
        if (cursor) params = params.set('cursor', cursor);

        return this.http
            .get<ActivityPageWire>(`${this.baseUrl}/web/activity`, { params })
            .pipe(map(toPage));
    }
}

function toPage(wire: ActivityPageWire): ActivityPage {
    return {
        items: (wire.items ?? []).map((item) => ({
            ...item,
            startedAt: new Date(item.startedAt),
            lastOccurredAt: new Date(item.lastOccurredAt),
            context: item.context ?? {},
        })),
        nextCursor: wire.nextCursor ?? null,
        hasMore: wire.hasMore,
    };
}
