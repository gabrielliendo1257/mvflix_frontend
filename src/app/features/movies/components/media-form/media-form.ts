import { Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MediaDraft } from '@features/movies/models/media-draft';
import { MediaKind } from '@features/movies/models/media-kind';
import { ChipsInput } from '@features/uploads/components/chips-input/chips-input';

export interface MediaFormValue {
    kind: MediaKind;
    metadata: MediaDraft;
}

@Component({
    selector: 'app-media-form',
    imports: [ReactiveFormsModule, ChipsInput],
    templateUrl: './media-form.html',
    styleUrl: './media-form.css',
})
export class MediaForm implements OnInit {
    private readonly fb = inject(NonNullableFormBuilder);

    readonly initial = input<MediaDraft | null>(null);
    readonly initialKind = input<MediaKind>('MOVIE');
    readonly submitLabel = input('Guardar');
    readonly externalDisabled = input(false);

    readonly submitted = output<MediaFormValue>();
    readonly valueChange = output<MediaDraft>();

    readonly kind = signal<MediaKind>('MOVIE');

    readonly form = this.fb.group({
        title: this.fb.control<string>('', Validators.required),
        originalTitle: this.fb.control<string>(''),
        year: this.fb.control<number | null>(null),
        genres: this.fb.control<string[]>([]),
        popularity: this.fb.control<number>(5),
        duration: this.fb.control<string>(''),
        director: this.fb.control<string>(''),
        cast: this.fb.control<string[]>([]),
        overview: this.fb.control<string>(''),
        poster_path: this.fb.control<string | null>(null),
        release_date: this.fb.control<string>(''),
        country: this.fb.control<string>(''),
        language: this.fb.control<string>(''),
        awards: this.fb.control<string[]>([]),
    });

    readonly controls = this.form.controls;

    readonly ratingStars = Array.from({ length: 10 }, (_, i) => i + 1);

    constructor() {
        effect(() => {
            const initial = this.initial();
            if (initial) {
                // El backend puede omitir campos de texto; el form espera strings.
                this.form.patchValue({ ...initial, release_date: initial.release_date ?? '' });
            }
        });

        this.form.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.valueChange.emit(this.form.getRawValue() as MediaDraft));
    }

    ngOnInit(): void {
        this.kind.set(this.initialKind());
    }

    setKind(value: MediaKind): void {
        this.kind.set(value);
    }

    setRating(value: number): void {
        this.controls.popularity.setValue(value);
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.submitted.emit({
            kind: this.kind(),
            metadata: this.form.getRawValue() as MediaDraft,
        });
    }
}
