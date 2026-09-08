import { TestBed } from '@angular/core/testing';

import { PendingAddMedia, UploadSessionPersistence } from './upload-session-persistence';

describe('UploadSessionPersistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('persiste metadata y fingerprint sin abrir IndexedDB', () => {
        const persistence = TestBed.inject(UploadSessionPersistence);
        const open = spyOn(indexedDB, 'open');

        persistence.savePending({
            userKey: 'alice',
            idempotencyKey: 'idem-4',
            addMediaId: 'add-4',
            movieId: null,
            fileFingerprint: {
                filename: 'video.mp4', size: 3_000_000_000,
                mimeType: 'video/mp4', lastModified: 789, addMediaId: 'add-4',
            },
            providerId: 4,
            draft: { title: 'Video' },
        });

        expect(open).not.toHaveBeenCalled();
        expect(persistence.loadPending('alice')[0]?.fileFingerprint.size).toBe(3_000_000_000);
    });

    it('conserva varios procesos y los separa por usuario', () => {
        const persistence = TestBed.inject(UploadSessionPersistence);
        const pending = (idempotencyKey: string, userKey: string): PendingAddMedia => ({
            userKey,
            idempotencyKey,
            addMediaId: `add-${idempotencyKey}`,
            movieId: null,
            fileFingerprint: {
                filename: `${idempotencyKey}.mp4`, size: 1, mimeType: 'video/mp4',
                lastModified: 1, addMediaId: `add-${idempotencyKey}`,
            },
            providerId: null,
            draft: { title: idempotencyKey },
        });

        persistence.savePending(pending('one', 'alice'));
        persistence.savePending(pending('two', 'alice'));
        persistence.savePending(pending('other', 'bob'));

        expect(persistence.loadPending('alice').map((item) => item.idempotencyKey)).toEqual(['one', 'two']);
        expect(persistence.loadPending('bob').map((item) => item.idempotencyKey)).toEqual(['other']);

        persistence.clearPending('alice', 'one');
        expect(persistence.loadPending('alice').map((item) => item.idempotencyKey)).toEqual(['two']);
    });

    it('elimina la base IndexedDB legacy una sola vez', () => {
        const deleteDatabase = spyOn(indexedDB, 'deleteDatabase').and.callThrough();

        TestBed.inject(UploadSessionPersistence);

        expect(deleteDatabase).toHaveBeenCalledWith('movieflix-uploads');
    });
});
