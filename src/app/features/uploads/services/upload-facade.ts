import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import {
    EMPTY,
    from,
    Observable,
    Subscription,
    catchError,
    filter,
    switchMap,
    take,
    takeWhile,
    tap,
    timer,
} from 'rxjs';
import {
    ACTIVE_UPLOAD_STATES,
    UploadDiagnostics,
    UploadFailureCode,
    UploadTask,
} from '@features/uploads/models/upload-task';
import { MediaKind } from '@features/movies/models/media-kind';
import { MediaDraft } from '@features/movies/models/media-draft';
import {
    AddMediaProcess,
    InitialAccess,
    MovieDraft,
    StartAddMediaCommand,
    UploadFileFingerprint,
    UploadInstructions,
} from '@features/uploads/models/add-media';
import { PendingAddMedia, UploadSessionPersistence } from '@features/uploads/services/upload-session-persistence';
import { AddMediaApi } from '@features/uploads/data-access/add-media-api';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Estado de la experiencia "Añadir contenido" en el cliente.
 *
 * El BFF es dueño de la coreografía (draft → upload → verify): este facade
 * expresa la intención (start con idempotencia), sube los bytes al storage y
 * sigue el veredicto. Cada tarea local se identifica por su idempotencyKey,
 * lo que hace seguros el reintento y la reanudación tras recargar.
 */
@Injectable({ providedIn: 'root' })
export class UploadFacade {
    private readonly addMediaApi = inject(AddMediaApi);
    private readonly persistence = inject(UploadSessionPersistence);

    readonly tasks = signal<UploadTask[]>([]);

    readonly activeCount = computed(
        () => this.tasks().filter((task) => ACTIVE_UPLOAD_STATES.has(task.state)).length,
    );

    private readonly subscriptions = new Map<string, Subscription>();

    constructor() {
        const userKey = sessionStorage.getItem('mvflix-session-subject');
        if (userKey) this.resumePending(userKey);
    }

    startUpload(
        file: File,
        metadata: MediaDraft,
        kind: MediaKind,
        access?: InitialAccess,
        providerId: number | null = null,
    ): string {
        const uploadId = newIdempotencyKey();

        this.tasks.update((tasks) => [
            {
                uploadId,
                addMediaId: null,
                movieId: null,
                providerId,
                file,
                fileName: file.name,
                fileFingerprint: null,
                progress: 0,
                state: 'starting',
                metadata,
                kind,
                access,
                failureCode: null,
                diagnostics: null,
            },
            ...tasks,
        ]);

        // Las películas necesitan proveedor; los vídeos genéricos no.
        if (kind === 'MOVIE' && (providerId == null || !Number.isFinite(providerId) || providerId <= 0)) {
            this.fail(uploadId, 'Selecciona un candidato primero.', 'PREPARING_FAILED');
            return uploadId;
        }

        this.runStart(uploadId, file);

        return uploadId;
    }

    retry(uploadId: string): void {
        const task = this.taskById(uploadId);
        // Evita doble submit mientras la tarea ya está activa.
        if (!task || ACTIVE_UPLOAD_STATES.has(task.state)) return;

        this.patchTask(uploadId, { state: 'starting', error: null });
        this.trackSubscription(
            uploadId,
            from(Promise.resolve(task.file))
                .pipe(
                    switchMap((file) => {
                        if (!file) throw new Error('Upload session expired.');
                        this.patchTask(uploadId, { file });

                        return task.addMediaId
                            ? this.addMediaApi.status(task.addMediaId).pipe(
                                  switchMap((process) => this.continueFrom(uploadId, process)),
                              )
                            : this.startProcess(uploadId, file);
                    }),
                    catchError((error) => {
                        this.fail(uploadId, error, 'PREPARING_FAILED');
                        return EMPTY;
                    }),
                )
                .subscribe(),
        );
    }

    /** Reintenta un proceso recuperado después de seleccionar el archivo original. */
    reselectFile(uploadId: string, file: File): void {
        const task = this.taskById(uploadId);
        if (!task || task.state !== 'waiting_for_file' || !task.fileFingerprint) return;

        if (!sameFingerprint(file, task.fileFingerprint)) {
            this.patchTask(uploadId, {
                error: `Selecciona el archivo original: ${task.fileFingerprint.filename}`,
            });
            return;
        }

        this.patchTask(uploadId, { file, state: 'starting', error: null });
        this.trackSubscription(
            uploadId,
            this.addMediaApi.status(task.fileFingerprint.addMediaId).pipe(
                switchMap((process) => this.continueFrom(uploadId, process)),
                catchError((error) => {
                    this.fail(uploadId, error, 'PREPARING_FAILED');
                    return EMPTY;
                }),
            ).subscribe(),
        );
    }

    cancel(uploadId: string): void {
        const task = this.taskById(uploadId);
        if (!task) return;

        this.subscriptions.get(uploadId)?.unsubscribe();
        this.subscriptions.delete(uploadId);

        if (task.addMediaId) {
            // Las compensaciones (draft/upload huérfanos) las ejecuta el BFF.
            this.addMediaApi.cancel(task.addMediaId).subscribe({ error: () => undefined });
        }

        this.patchTask(uploadId, { state: 'cancelled' });
        this.persistence.clearPending(this.userKey(), uploadId);
    }

    remove(uploadId: string): void {
        this.cancel(uploadId);
        this.tasks.update((tasks) => tasks.filter((task) => task.uploadId !== uploadId));
    }

    taskById(uploadId: string): UploadTask | null {
        return this.tasks().find((task) => task.uploadId === uploadId) ?? null;
    }

    // ─── Flujo principal ───

    /** Lanza el proceso de alta y gestiona su ciclo de vida. */
    private runStart(uploadId: string, file: File): void {
        this.trackSubscription(
            uploadId,
            this.startProcess(uploadId, file)
                .pipe(
                    catchError((error) => {
                        this.fail(uploadId, error, 'PREPARING_FAILED');
                        return EMPTY;
                    }),
                )
                .subscribe(),
        );
    }

    private startProcess(uploadId: string, file: File): Observable<unknown> {
        // La intención completa vive en la tarea: draft + kind + acceso inicial.
        const task = this.taskById(uploadId);
        if (!task) return EMPTY;

        const command = toCommand(uploadId, file, task.metadata, task.kind, task.access, task.providerId);

        return this.addMediaApi.start(command).pipe(
            tap((process) => {
                const fingerprint = fingerprintFrom(task.file!, process.addMediaId);
                this.patchTask(uploadId, { fileFingerprint: fingerprint });
                this.persistence.savePending(toPending(this.userKey(), uploadId, task, process, fingerprint));
            }),
            switchMap((process) => this.continueFrom(uploadId, process)),
        );
    }

    /** Siguiente paso según la fase reportada por el BFF. */
    private continueFrom(uploadId: string, process: AddMediaProcess): Observable<unknown> {
        this.patchTask(uploadId, { addMediaId: process.addMediaId, movieId: process.movieId });

        switch (process.phase) {
            case 'READY':
                this.finish(uploadId);
                return EMPTY;
            case 'FAILED':
                this.fail(uploadId, process.failureCode ?? 'ADD_MEDIA_FAILED', 'VERIFICATION_FAILED');
                return EMPTY;
            case 'CANCELLED':
            case 'CANCELLING':
                this.patchTask(uploadId, { state: 'cancelled' });
                return EMPTY;
            case 'VERIFYING_UPLOAD':
            case 'FINALIZING':
                return this.awaitVerdict(uploadId, process.addMediaId);
            default:
                // STARTING / PREPARING / WAITING_FOR_UPLOAD
                return process.upload
                    ? this.uploadAndComplete(uploadId, process)
                    : this.pollUntilActionable(process.addMediaId).pipe(
                          switchMap((next) => this.continueFrom(uploadId, next)),
                      );
        }
    }

    private uploadAndComplete(uploadId: string, process: AddMediaProcess): Observable<unknown> {
        const instructions = process.upload as UploadInstructions;
        const startedAt = performance.now();

        this.patchTask(uploadId, {
            state: 'uploading',
            progress: 0,
            diagnostics: createDiagnostics(instructions, this.taskById(uploadId)?.file),
        });

        return from(Promise.resolve(this.taskById(uploadId)?.file ?? null)).pipe(
            switchMap((resolved) => {
                if (!resolved) throw new Error('Upload session expired.');
                this.patchTask(uploadId, { file: resolved });

                return this.addMediaApi.uploadToStorage(resolved, instructions).pipe(
                    tap((event) => {
                        if (event.type !== HttpEventType.UploadProgress) return;
                        this.patchTask(uploadId, {
                            progress: Math.round((100 * event.loaded) / (event.total ?? 1)),
                            diagnostics: updateDiagnostics(
                                this.taskById(uploadId)?.diagnostics ?? null,
                                startedAt,
                                event.loaded,
                                event.total,
                            ),
                        });
                    }),
                    filter((event) => event.type === HttpEventType.Response),
                    switchMap(() => this.addMediaApi.complete(process.addMediaId, resolved.size)),
                );
            }),
            switchMap((verdict) => this.continueFrom(uploadId, verdict)),
            catchError((error) => {
                this.fail(uploadId, error, classifyUploadFailure(error));
                return EMPTY;
            }),
        );
    }

    /** complete devolvió 202: storage aún verifica; sondeo hasta veredicto. */
    private awaitVerdict(uploadId: string, addMediaId: string): Observable<unknown> {
        this.patchTask(uploadId, { state: 'verifying' });

        return this.poll(addMediaId, (p) => p.phase === 'READY' || p.phase === 'FAILED').pipe(
            tap((final) => {
                if (final.phase === 'READY') {
                    this.finish(uploadId);
                } else {
                    this.fail(uploadId, final.failureCode ?? 'UPLOAD_VERIFICATION_FAILED', 'VERIFICATION_FAILED');
                }
            }),
            catchError(() => {
                this.fail(uploadId, 'UPLOAD_VERIFICATION_TIMEOUT', 'VERIFICATION_FAILED');
                return EMPTY;
            }),
        );
    }

    private pollUntilActionable(addMediaId: string): Observable<AddMediaProcess> {
        return this.poll(
            addMediaId,
            (p) => p.phase !== 'STARTING' && p.phase !== 'PREPARING',
        );
    }

    /** Sondea estado; emite el último valor al cumplirse la condición o agotar intentos. */
    private poll(
        addMediaId: string,
        done: (process: AddMediaProcess) => boolean,
    ): Observable<AddMediaProcess> {
        return timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS).pipe(
            switchMap(() => this.addMediaApi.status(addMediaId)),
            takeWhile(done, /* inclusive */ true),
            take(MAX_POLLS + 1),
        );
    }

    // ─── Reanudación tras recarga ───

    private resumePending(userKey: string): void {
        const pending = this.persistence.loadPending(userKey);
        if (!pending.length) return;

        this.tasks.update((tasks) => [
            ...pending.map((item) => ({
                uploadId: item.idempotencyKey,
                addMediaId: item.addMediaId,
                movieId: item.movieId,
                providerId: item.providerId,
                file: null,
                fileName: item.fileFingerprint.filename,
                fileFingerprint: item.fileFingerprint,
                progress: 0,
                state: 'waiting_for_file' as const,
                metadata: pendingMetadata(item),
                kind: item.draft.kind ?? 'MOVIE',
                access: item.access,
                failureCode: null,
                diagnostics: null,
            })),
            ...tasks,
        ]);

    }

    // ─── Helpers ───

    private finish(uploadId: string): void {
        this.patchTask(uploadId, { state: 'completed', progress: 100 });
        this.persistence.clearPending(this.userKey(), uploadId);
    }

    private fail(uploadId: string, error: unknown, failureCode: UploadFailureCode): void {
        const task = this.taskById(uploadId);
        const diagnostics = task?.diagnostics
            ? { ...task.diagnostics, errorType: errorType(error) }
            : null;
        this.patchTask(uploadId, {
            state: 'failed',
            error: failureMessage(error, failureCode),
            failureCode,
            diagnostics,
        });
        if (diagnostics) {
            // Nunca se registra la URL: solo el host extraído de las instrucciones.
            console.warn('[UploadFacade] upload failure diagnostics', diagnostics);
        }
        this.persistence.clearPending(this.userKey(), uploadId);
    }

    private patchTask(uploadId: string, patch: Partial<UploadTask>): void {
        this.tasks.update((tasks) =>
            tasks.map((task) => (task.uploadId === uploadId ? { ...task, ...patch } : task)),
        );
    }

    private trackSubscription(uploadId: string, subscription: Subscription): void {
        this.subscriptions.get(uploadId)?.unsubscribe();
        this.subscriptions.set(uploadId, subscription);
    }

    private userKey(): string {
        return sessionStorage.getItem('mvflix-session-subject') ?? '';
    }
}

function toCommand(
    idempotencyKey: string,
    file: File,
    metadata: MediaDraft,
    kind: MediaKind,
    access?: InitialAccess,
    providerId: number | null = null,
): StartAddMediaCommand {
    return {
        file: {
            filename: file.name,
            sizeBytes: file.size,
            mimeType: file.type || 'application/octet-stream',
        },
        movie: {
            providerId: kind === 'MOVIE' ? providerId : null,
            draft: toDraft(metadata, kind),
        },
        access,
        idempotencyKey,
    };
}

function toPending(
    userKey: string,
    idempotencyKey: string,
    task: UploadTask,
    process: AddMediaProcess,
    fileFingerprint: UploadFileFingerprint,
): PendingAddMedia {
    return {
        userKey,
        idempotencyKey,
        addMediaId: process.addMediaId,
        movieId: process.movieId,
        fileFingerprint,
        providerId: task.providerId,
        draft: toDraft(task.metadata, task.kind),
        access: task.access,
    };
}

function fingerprintFrom(file: File, addMediaId: string): UploadFileFingerprint {
    return {
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        addMediaId,
    };
}

function sameFingerprint(file: File, fingerprint: UploadFileFingerprint): boolean {
    return (
        file.name === fingerprint.filename &&
        file.size === fingerprint.size &&
        (file.type || 'application/octet-stream') === fingerprint.mimeType &&
        file.lastModified === fingerprint.lastModified
    );
}

function toDraft(metadata: MediaDraft, kind: MediaKind): MovieDraft {
    return {
        title: metadata.title,
        originalTitle: metadata.originalTitle,
        year: metadata.year,
        genres: metadata.genres,
        popularity: metadata.popularity,
        duration: metadata.duration,
        director: metadata.director,
        cast: metadata.cast,
        overview: metadata.overview,
        poster_path: metadata.poster_path,
        release_date: metadata.release_date ?? undefined,
        country: metadata.country,
        language: metadata.language,
        awards: metadata.awards,
        kind,
    };
}

/** Reconstruye la metadata mínima para reintentos desde un proceso persistido. */
function pendingMetadata(pending: PendingAddMedia): MediaDraft {
    return {
        title: pending.draft.title,
        originalTitle: pending.draft.originalTitle ?? '',
        year: pending.draft.year ?? null,
        genres: pending.draft.genres ?? [],
        popularity: pending.draft.popularity ?? 5,
        duration: pending.draft.duration ?? '',
        director: pending.draft.director ?? '',
        cast: pending.draft.cast ?? [],
        overview: pending.draft.overview ?? '',
        poster_path: pending.draft.poster_path ?? null,
        release_date: pending.draft.release_date ?? '',
        country: pending.draft.country ?? '',
        language: pending.draft.language ?? '',
        awards: pending.draft.awards ?? [],
    };
}

function failureMessage(error: unknown, failureCode: UploadFailureCode): string {
    switch (failureCode) {
        case 'UPLOAD_CONNECTION_INTERRUPTED':
            return 'La conexión del upload se interrumpió. Revisa MinIO, la red o vuelve a intentarlo.';
        case 'UPLOAD_EXPIRED':
            return 'Las instrucciones del upload expiraron. Vuelve a intentarlo.';
        case 'UPLOAD_REJECTED':
            return 'MinIO rechazó el archivo. Revisa el tipo, tamaño o permisos y vuelve a intentarlo.';
        case 'VERIFICATION_FAILED':
            return 'La verificación del upload falló. Vuelve a intentarlo.';
        case 'PREPARING_FAILED':
            return `No se pudo preparar el upload. ${toMessage(error)}`;
    }
}

/** Mensaje legible priorizando el cuerpo del BFF: {code, error, message}. */
function toMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        const body = error.error as { code?: number; error?: string; message?: string } | null;
        if (body?.message) return body.message;
        if (body?.error) return body.error;

        if (error.status === 409) return 'La subida fue rechazada por el servidor.';
        if (error.status === 403) return 'No tienes permiso para añadir contenido.';
        if (error.status === 401) return 'Inicia sesión para añadir contenido.';
        if (error.status === 0) return 'La conexión con el servidor fue interrumpida.';
        return `Error ${error.status} al procesar la subida.`;
    }
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : 'Upload failed.';
}

function classifyUploadFailure(error: unknown): UploadFailureCode {
    if (!(error instanceof HttpErrorResponse)) return 'UPLOAD_CONNECTION_INTERRUPTED';
    if (error.status === 0 || error.status === 408) return 'UPLOAD_CONNECTION_INTERRUPTED';
    if (error.status === 401 || error.status === 403) return 'UPLOAD_EXPIRED';
    return 'UPLOAD_REJECTED';
}

function createDiagnostics(
    instructions: UploadInstructions,
    file: File | null | undefined,
): UploadDiagnostics {
    return {
        uploadHost: safeHost(instructions.url),
        fileSize: file?.size ?? 0,
        elapsedTimeMs: 0,
        lastUploadedByte: 0,
        lastProgressPercentage: 0,
        errorType: null,
    };
}

function updateDiagnostics(
    current: UploadDiagnostics | null,
    startedAt: number,
    uploadedByte: number,
    total: number | undefined,
): UploadDiagnostics | null {
    if (!current) return null;
    return {
        ...current,
        elapsedTimeMs: Math.round(performance.now() - startedAt),
        lastUploadedByte: uploadedByte,
        lastProgressPercentage: Math.round((100 * uploadedByte) / (total || current.fileSize || 1)),
    };
}

function safeHost(url: string): string | null {
    try {
        return new URL(url).host || null;
    } catch {
        return null;
    }
}

function errorType(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        const detail = error.error as { name?: string; type?: string } | null;
        return detail?.name ?? detail?.type ?? error.name ?? 'HttpErrorResponse';
    }
    if (error instanceof Error) return error.name;
    return typeof error;
}

/**
 * Clave de idempotencia del proceso. `crypto.randomUUID` solo existe en
 * contextos seguros (HTTPS/localhost); al servir por HTTP en LAN caemos a
 * UUID v4 vía getRandomValues, disponible en cualquier contexto.
 */
function newIdempotencyKey(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === 'function') {
        return '10000000-1000-4000-8000-100000000000'.replace(
            /[018]/g,
            (position) =>
                (
                    +position ^
                    (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+position / 4)))
                ).toString(16),
        );
    }

    // Último recurso para entornos sin Web Crypto (no debería ocurrir).
    const random = () => Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${random()}-${random()}`;
}
