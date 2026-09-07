import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ActivityItem, ActivityPage } from '@features/activity/models/activity';
import { ActivityApi } from './activity-api';
import { ActivityStore } from './activity-store';

describe('ActivityStore', () => {
    let store: ActivityStore;
    let api: jasmine.SpyObj<ActivityApi>;

    beforeEach(() => {
        api = jasmine.createSpyObj<ActivityApi>('ActivityApi', ['get']);
        TestBed.configureTestingModule({
            providers: [ActivityStore, { provide: ActivityApi, useValue: api }],
        });
        store = TestBed.inject(ActivityStore);
    });

    it('carga páginas, deduplica por activityId y conserva la metadata más reciente', () => {
        api.get.and.returnValues(
            of(page([item('a', 'old'), item('b', 'one')], 'cursor-2', true)),
            of(page([item('b', 'new'), item('c', 'three')], null, false)),
        );

        store.load();
        store.loadMore();

        expect(api.get.calls.allArgs()).toEqual([[null, 20], ['cursor-2', 20]]);
        expect(store.items().map((value) => value.activityId)).toEqual(['a', 'b', 'c']);
        expect(store.items()[1].resourceTitle).toBe('new');
        expect(store.hasMore()).toBeFalse();
        expect(store.loading()).toBeFalse();
    });

    it('expone error y retry vuelve a cargar la primera página', () => {
        api.get.and.returnValues(throwError(() => new Error('offline')), of(page([item('a', 'ok')], null, false)));

        store.load();
        expect(store.error()).toBe('No se pudo cargar la actividad.');
        expect(store.loading()).toBeFalse();

        store.retry();

        expect(api.get.calls.count()).toBe(2);
        expect(store.error()).toBeNull();
        expect(store.items().length).toBe(1);
    });
});

function item(activityId: string, title: string): ActivityItem {
    return {
        activityId, correlationId: null, type: 'UPLOAD', status: 'COMPLETED',
        startedAt: new Date(), lastOccurredAt: new Date(), fileName: null,
        catalogItemId: null, failureCode: null, cursor: activityId, category: null,
        severity: 'INFO', resourceType: 'MEDIA', resourceId: activityId,
        resourceTitle: title, context: {},
    };
}

function page(items: ActivityItem[], nextCursor: string | null, hasMore: boolean): ActivityPage {
    return { items, nextCursor, hasMore };
}
