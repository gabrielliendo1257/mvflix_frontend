import { inject, Injectable } from '@angular/core';
import { InitialAccess, MovieDraft, UploadFileFingerprint } from '@features/uploads/models/add-media';

const PENDING_KEY = 'pending-add-media';
const LEGACY_DB_NAME = 'movieflix-uploads';
const LEGACY_DB_CLEANED_KEY = 'movieflix-uploads-db-cleaned';

/** Proceso de alta pendiente de cerrar; sobrevive recargas de página. */
export interface PendingAddMedia {
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
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    }

    loadPending(): PendingAddMedia | null {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;

        try {
            const pending = JSON.parse(raw) as Partial<PendingAddMedia>;
            if (!pending.idempotencyKey || !pending.fileFingerprint?.addMediaId) {
                this.removePending();
                return null;
            }
            return pending as PendingAddMedia;
        } catch {
            this.removePending();
            return null;
        }
    }

    /** Solo borra el registro si sigue siendo el mismo proceso. */
    clearPending(idempotencyKey: string): void {
        if (this.loadPending()?.idempotencyKey !== idempotencyKey) return;
        this.removePending();
    }

    removePending(): void {
        localStorage.removeItem(PENDING_KEY);
    }

    private removeLegacyFileDatabase(): void {
        if (typeof indexedDB === 'undefined' || localStorage.getItem(LEGACY_DB_CLEANED_KEY)) return;

        const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
        request.onsuccess = request.onerror = request.onblocked = () => {
            localStorage.setItem(LEGACY_DB_CLEANED_KEY, '1');
        };
    }

}
