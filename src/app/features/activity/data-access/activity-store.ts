import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Subject, catchError, concatMap, finalize, tap } from 'rxjs';
import { ActivityApi } from './activity-api';
import { ActivityItem } from '@features/activity/models/activity';

const PAGE_SIZE = 20;

@Injectable()
export class ActivityStore {
    private readonly api = inject(ActivityApi);
    private readonly requests = new Subject<{ cursor: string | null; reset: boolean }>();

    readonly items = signal<ActivityItem[]>([]);
    readonly nextCursor = signal<string | null>(null);
    readonly hasMore = signal(false);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    private requestedCursor: string | null = null;
    private loaded = false;

    constructor() {
        this.requests
            .pipe(
                tap(() => this.loading.set(true)),
                concatMap(({ cursor, reset }) => this.api.get(cursor, PAGE_SIZE).pipe(
                    tap((page) => {
                        this.mergePage(page.items, reset);
                        this.nextCursor.set(page.nextCursor);
                        this.hasMore.set(page.hasMore);
                        this.requestedCursor = page.nextCursor;
                        this.loaded = true;
                        this.error.set(null);
                    }),
                    catchError(() => {
                        this.error.set('No se pudo cargar la actividad.');
                        return EMPTY;
                    }),
                    finalize(() => this.loading.set(false)),
                )),
            )
            .subscribe();
    }

    load(): void {
        if (this.loading()) return;
        this.items.set([]);
        this.nextCursor.set(null);
        this.hasMore.set(false);
        this.requestedCursor = null;
        this.loaded = false;
        this.error.set(null);
        this.requests.next({ cursor: null, reset: true });
    }

    loadMore(): void {
        if (this.loading() || !this.hasMore() || !this.nextCursor()) return;
        this.requests.next({ cursor: this.nextCursor(), reset: false });
    }

    retry(): void {
        if (this.loading()) return;
        if (this.loaded && this.requestedCursor) {
            this.requests.next({ cursor: this.requestedCursor, reset: false });
        } else {
            this.load();
        }
    }

    private mergePage(incoming: ActivityItem[], reset: boolean): void {
        const current = reset ? [] : this.items();
        const byId = new Map(current.map((item) => [item.activityId, item]));
        for (const item of incoming) byId.set(item.activityId, item);
        this.items.set([...byId.values()]);
    }
}
