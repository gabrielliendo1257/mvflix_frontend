import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '@core/session/auth.service';
import { ShellContext } from '@features/shell/models/shell-context';
import { ShellApi } from './shell-api';
import { ShellStore } from './shell-store';

describe('ShellStore', () => {
    it('limpia el contexto anterior al cerrar sesión', () => {
        const logged = signal(true);
        const context: ShellContext = {
            authenticated: true,
            user: null,
            capabilities: {
                canAddMedia: true,
                canManageLibraries: true,
                canAccessAdmin: true,
                canManageAnyLibrary: true,
                canModerateCatalog: true,
                canViewAllActivity: true,
            },
            activity: null,
            quota: null,
        };

        TestBed.configureTestingModule({
            providers: [
                ShellStore,
                { provide: AuthService, useValue: { isLogged: logged } },
                { provide: ShellApi, useValue: { getContext: () => of(context) } },
            ],
        });

        const store = TestBed.inject(ShellStore);
        TestBed.flushEffects();
        expect(store.context()).toEqual(context);

        logged.set(false);
        TestBed.flushEffects();

        expect(store.context()).toBeNull();
    });
});
