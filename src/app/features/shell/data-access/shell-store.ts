import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '@core/session/auth.service';
import { ShellApi } from '@features/shell/data-access/shell-api';
import { ShellContext } from '@features/shell/models/shell-context';

/**
 * Contexto de arranque del shell (GET /web/shell): identidad y capacidades
 * para construir la navegación. Un fetch por sesión; si el BFF falla el
 * shell sigue vivo con capacidades conservadoras (null = UI decide fallback).
 */
@Injectable({ providedIn: 'root' })
export class ShellStore {
    private readonly api = inject(ShellApi);
    private readonly authService = inject(AuthService);

    private readonly _context = signal<ShellContext | null>(null);
    private readonly _ready = signal(false);

    readonly context = this._context.asReadonly();
    readonly ready = this._ready.asReadonly();

    readonly user = computed(() => this._context()?.user ?? null);

    /** Indicador de cuota ya filtrado: null cuando no está disponible. */
    readonly quota = computed(() => {
        const quota = this._context()?.quota;
        return quota?.available ? quota : null;
    });

    constructor() {
        toObservable(this.authService.isLogged)
            .pipe(
                switchMap((logged) => {
                    this._ready.set(false);
                    return logged
                        ? this.api.getContext().pipe(
                              catchError(() => of(null)),
                              finalize(() => this._ready.set(true)),
                          )
                        : of(null).pipe(finalize(() => this._ready.set(true)));
                }),
            )
            .subscribe((context) => this._context.set(context));
    }
}
