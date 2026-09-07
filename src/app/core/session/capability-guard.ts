import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { ShellStore } from '@features/shell/data-access/shell-store';
import { ShellCapabilities } from '@features/shell/models/shell-context';
import { filter, map, take } from 'rxjs';

export type ShellCapability = keyof ShellCapabilities;

/** Guard de coherencia UX; el backend sigue siendo la autoridad final. */
export const capabilityGuard = (capability: ShellCapability): CanMatchFn => (_route, _segments) => {
    const shell = inject(ShellStore);
    const router = inject(Router);

    const check = () => shell.context()?.capabilities[capability] === true;
    if (!shell.ready()) {
        return toObservable(shell.ready).pipe(
            filter(Boolean),
            take(1),
            map(() => check() ? true : router.createUrlTree(['/movies'])),
        );
    }
    return check() ? true : router.createUrlTree(['/movies']);
};
