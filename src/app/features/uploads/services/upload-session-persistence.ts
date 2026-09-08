import { inject, Injectable } from '@angular/core';
import { InitialAccess, MovieDraft, UploadFileFingerprint } from '@features/uploads/models/add-media';

const PENDING_KEY = 'pending-add-media';
const LEGACY_DB_NAME = 'movieflix-uploads';
const LEGACY_DB_CLEANED_KEY = 'movieflix-uploads-db-cleaned';

/** Proceso de alta pendiente de cerrar; sobrevive recargas de página. */
export interface PendingAddMedia {
    userKey: string;
    idempotencyKey: string;
    addMediaId: string | null;
    movieId: number | null;
    fileFingerprint: UploadFileFingerprint;
    providerId: number | null;
    draft: MovieDraft;
    access?: InitialAccess;
}

@Injectable({ providedIn: 'root' })
export class UploadSessionPersistence {
    constructor() {
        this.removeLegacyFileDatabase();
    }

    savePending(pending: PendingAddMedia): void {
        const pendingByUser = this.loadAll();
        const index = pendingByUser.findIndex((item) => item.userKey === pending.userKey
            && item.idempotencyKey === pending.idempotencyKey);
        if (index >= 0) pendingByUser[index] = pending;
        else pendingByUser.push(pending);
        localStorage.setItem(PENDING_KEY, JSON.stringify(pendingByUser));
    }

    loadPending(userKey: string): PendingAddMedia[] {
        return this.loadAll().filter((pending) => pending.userKey === userKey);
    }

    /** Solo borra el registro si sigue siendo el mismo proceso. */
    clearPending(userKey: string, idempotencyKey: string): void {
        const pendingByUser = this.loadAll().filter((pending) =>
            !(pending.userKey === userKey && pending.idempotencyKey === idempotencyKey));
        this.write(pendingByUser);
    }

    removePending(userKey?: string): void {
        if (!userKey) {
            localStorage.removeItem(PENDING_KEY);
            return;
        }
        this.write(this.loadAll().filter((pending) => pending.userKey !== userKey));
    }

    private loadAll(): PendingAddMedia[] {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as Partial<PendingAddMedia>[];
            if (!Array.isArray(parsed)) throw new Error('Invalid pending uploads');
            return parsed.filter((pending) => pending.userKey && pending.idempotencyKey
                && pending.fileFingerprint?.addMediaId) as PendingAddMedia[];
        } catch {
            localStorage.removeItem(PENDING_KEY);
            return [];
        }
    }

    private write(pending: PendingAddMedia[]): void {
        if (pending.length) localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        else localStorage.removeItem(PENDING_KEY);
    }

    private removeLegacyFileDatabase(): void {
        if (typeof indexedDB === 'undefined' || localStorage.getItem(LEGACY_DB_CLEANED_KEY)) return;

        const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
        request.onsuccess = request.onerror = request.onblocked = () => {
            localStorage.setItem(LEGACY_DB_CLEANED_KEY, '1');
        };
    }

}
