import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MoviesApi } from '@features/movies/data-access/movies-api';
import { PlaybackApi } from '@features/player/data-access/playback-api';
import { PlaybackSession } from '@features/player/models/playback';
import { WatchStore } from './watch-store';

describe('WatchStore', () => {
    let store: WatchStore;
    let playbackApi: jasmine.SpyObj<PlaybackApi>;

    beforeEach(() => {
        playbackApi = jasmine.createSpyObj<PlaybackApi>('PlaybackApi', ['start', 'recordProgress']);
        playbackApi.start.and.returnValue(of(session()));
        playbackApi.recordProgress.and.returnValue(of({ sequence: 1, positionSeconds: 0, status: 'RECORDED' }));

        TestBed.configureTestingModule({
            providers: [
                WatchStore,
                { provide: MoviesApi, useValue: { findById: () => of({}) } },
                { provide: PlaybackApi, useValue: playbackApi },
            ],
        });
        store = TestBed.inject(WatchStore);
        store.load(42);
    });

    it('envía el primer snapshot, limita timeupdate y mantiene sequence monotónica', fakeAsync(() => {
        store.onSnapshot({ positionSeconds: 10.4, durationSeconds: 100, completed: false });
        tick(5_000);
        store.onSnapshot({ positionSeconds: 15.4, durationSeconds: 100, completed: false });
        tick(5_000);
        store.onSnapshot({ positionSeconds: 20.4, durationSeconds: 100, completed: false });

        expect(playbackApi.recordProgress.calls.allArgs()).toEqual([
            ['session-1', { sequence: 1, positionSeconds: 10, durationSeconds: 100, completed: false }],
            ['session-1', { sequence: 2, positionSeconds: 20, durationSeconds: 100, completed: false }],
        ]);
    }));

    it('envía al pausar aunque no hayan pasado 10 segundos', fakeAsync(() => {
        store.onSnapshot({ positionSeconds: 5, durationSeconds: 20, completed: false });
        tick(2_000);
        store.onSnapshot({ positionSeconds: 6, durationSeconds: 20, completed: false });
        store.onPaused();

        expect(playbackApi.recordProgress.calls.count()).toBe(2);
        expect(playbackApi.recordProgress.calls.argsFor(1)[1]).toEqual({
            sequence: 2, positionSeconds: 6, durationSeconds: 20, completed: false,
        });
    }));

    it('envía completed=true al finalizar', fakeAsync(() => {
        store.onSnapshot({ positionSeconds: 99, durationSeconds: 100, completed: true });

        expect(playbackApi.recordProgress.calls.argsFor(0)[1]).toEqual({
            sequence: 1, positionSeconds: 99, durationSeconds: 100, completed: true,
        });
    }));

    it('absorbe errores temporales y sigue procesando snapshots posteriores', fakeAsync(() => {
        playbackApi.recordProgress.and.returnValues(
            throwError(() => new Error('temporary')),
            of({ sequence: 2, positionSeconds: 20, status: 'RECORDED' }),
        );

        store.onSnapshot({ positionSeconds: 10, durationSeconds: 100, completed: false });
        tick(10_000);
        store.onSnapshot({ positionSeconds: 20, durationSeconds: 100, completed: false });

        expect(playbackApi.recordProgress.calls.count()).toBe(2);
        expect(playbackApi.recordProgress.calls.argsFor(1)[1]).toEqual({
            sequence: 2, positionSeconds: 20, durationSeconds: 100, completed: false,
        });
    }));
});

function session(): PlaybackSession {
    return {
        sessionId: 'session-1',
        media: { id: 42, title: 'Movie', posterPath: null, duration: '100' },
        source: { strategy: 'DIRECT', url: 'https://media.test/video', mimeType: 'video/mp4', expiresAt: null },
        resumeSeconds: null,
    };
}
