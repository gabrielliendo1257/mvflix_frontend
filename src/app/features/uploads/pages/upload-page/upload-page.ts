import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject } from 'rxjs';
import { ToastService } from '@core/ui/toast.service';
import { UploadFacade } from '@features/uploads/services/upload-facade';
import { ACTIVE_UPLOAD_STATES } from '@features/uploads/models/upload-task';
import { InitialAccess, InitialVisibility } from '@features/uploads/models/add-media';
import { MediaDraft } from '@features/movies/models/media-draft';
import { ProviderCandidate } from '@features/movies/models/provider-candidate';
import { MediaForm, MediaFormValue } from '@features/movies/components/media-form/media-form';
import { MovieSearchModal } from '@features/uploads/components/movie-search-modal/movie-search-modal';
import { ChipsInput } from '@features/uploads/components/chips-input/chips-input';

const DRAFT_METADATA_KEY = 'movie-draft';

const VISIBILITY_OPTIONS: { value: InitialVisibility; label: string; hint: string }[] = [
    { value: 'PRIVATE', label: 'Privada', hint: 'Solo tú puedes verla' },
    { value: 'PUBLIC', label: 'Pública', hint: 'Visible para todos' },
    { value: 'SHARED', label: 'Compartida', hint: 'Solo los usuarios indicados' },
];

@Component({
    selector: 'app-upload-page',
    imports: [FormsModule, MediaForm, MovieSearchModal, ChipsInput],
    templateUrl: './upload-page.html',
    styleUrl: './upload-page.css',
})
export class UploadPage {
    private readonly uploadFacade = inject(UploadFacade);
    private readonly toast = inject(ToastService);

    private readonly draftSubject = new Subject<MediaDraft>();

    readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

    readonly visibilityOptions = VISIBILITY_OPTIONS;

    readonly file = signal<File | null>(null);
    readonly metadata = signal<MediaDraft | null>(null);
    readonly searchOpen = signal(false);
    readonly taskId = signal<string | null>(null);

    /** Candidato TMDB identificado; solo es obligatorio para contenido MOVIE. */
    readonly identified = signal<{ providerId: number; title: string; year: number | null } | null>(null);

    // Acceso inicial del contenido (el BFF lo aplica al crear el draft).
    readonly visibility = signal<InitialVisibility>('PRIVATE');
    readonly sharedWith = signal<string[]>([]);

    readonly task = computed(() => {
        const id = this.taskId();
        return id ? this.uploadFacade.taskById(id) : null;
    });

    readonly isUploading = computed(() => {
        const task = this.task();
        return task ? ACTIVE_UPLOAD_STATES.has(task.state) : false;
    });

    readonly progress = computed(() => this.task()?.progress ?? 0);

    readonly error = computed(() => this.task()?.error ?? null);

    constructor() {
        this.restoreDrafts();

        this.draftSubject
            .pipe(takeUntilDestroyed(), debounceTime(400))
            .subscribe((metadata) => localStorage.setItem(DRAFT_METADATA_KEY, JSON.stringify(metadata)));

        effect(() => {
            const task = this.task();
            if (task?.state === 'completed') {
                this.resetAfterFinish();
                this.toast.success('Media subida correctamente.');
            } else if (task?.state === 'failed') {
                this.resetAfterFinish();
                this.toast.error(task.error ?? 'Upload failed.');
            }
        });
    }

    selectFile(): void {
        this.fileInput()?.nativeElement.click();
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.file.set(file);
        input.value = '';
    }

    openSearch(): void {
        this.searchOpen.set(true);
    }

    onMovieSelected(movie: ProviderCandidate): void {
        const { id: _providerId, ...draft } = movie;
        this.metadata.set(draft);
        this.identified.set({
            providerId: movie.id,
            title: movie.title,
            year: movie.year ?? parseYear(movie.release_date),
        });
        this.searchOpen.set(false);
    }

    clearCandidate(): void {
        this.identified.set(null);
        this.metadata.set(null);
    }

    onMetadataChange(metadata: MediaDraft): void {
        this.draftSubject.next(metadata);
    }

    onSubmit(value: MediaFormValue): void {
        const file = this.file();
        if (!file) {
            this.toast.warning('Selecciona un archivo primero.');
            return;
        }

        const candidate = this.identified();
        if (value.kind === 'MOVIE' && !candidate) {
            // Espejo del INVALID_INTENT del BFF: sin candidato no se crea nada.
            this.toast.warning('Selecciona un candidato primero (Autocomplete).');
            return;
        }

        const access = this.buildAccess();
        if (access === null) return;

        this.taskId.set(this.uploadFacade.startUpload(
            file, value.metadata, value.kind, access, candidate?.providerId ?? null,
        ));
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** SHARED exige al menos un usuario; PRIVATE/PUBLIC no envían nada extra. */
    private buildAccess(): InitialAccess | null {
        const visibility = this.visibility();

        if (visibility === 'SHARED') {
            if (!this.sharedWith().length) {
                this.toast.warning('Añade al menos un usuario para compartir.');
                return null;
            }
            return { visibility, sharedWith: [...this.sharedWith()] };
        }

        return { visibility };
    }

    private resetAfterFinish(): void {
        this.taskId.set(null);
        this.clearDrafts();
        this.identified.set(null);
        this.visibility.set('PRIVATE');
        this.sharedWith.set([]);
    }

    private restoreDrafts(): void {
        const raw = localStorage.getItem(DRAFT_METADATA_KEY);
        if (raw) {
            try {
                this.metadata.set(JSON.parse(raw) as MediaDraft);
            } catch {
                localStorage.removeItem(DRAFT_METADATA_KEY);
            }
        }

    }

    private clearDrafts(): void {
        localStorage.removeItem(DRAFT_METADATA_KEY);
        this.metadata.set(null);
        this.file.set(null);
    }
}

function parseYear(releaseDate: string | null | undefined): number | null {
    const year = Number(releaseDate?.slice(0, 4));
    return Number.isFinite(year) && year > 0 ? year : null;
}
