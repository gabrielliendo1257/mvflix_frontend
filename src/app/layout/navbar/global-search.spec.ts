import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { SearchApi } from '@features/search/data-access/search-api';
import { GlobalSearch } from './global-search';

describe('GlobalSearch', () => {
    let fixture: ComponentFixture<GlobalSearch>;
    let component: GlobalSearch;
    let searchApi: jasmine.SpyObj<SearchApi>;
    let router: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        searchApi = jasmine.createSpyObj<SearchApi>('SearchApi', ['search']);
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        await TestBed.configureTestingModule({
            imports: [GlobalSearch],
            providers: [{ provide: SearchApi, useValue: searchApi }, { provide: Router, useValue: router }],
        }).compileComponents();
        fixture = TestBed.createComponent(GlobalSearch);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('aplica debounce y navega a watch para resultados reproducibles', fakeAsync(() => {
        searchApi.search.and.returnValue(of([{ id: 7, title: 'Alien', originalTitle: null, year: 1979, posterUrl: null, kind: 'MOVIE', status: 'READY', playable: true }]));

        component.onTermChange('ali');
        tick(249);
        expect(searchApi.search).not.toHaveBeenCalled();
        tick(1);
        expect(searchApi.search).toHaveBeenCalledWith('ali');
        component.activeIndex.set(0);
        component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(router.navigate).toHaveBeenCalledWith(['/watch', 7]);
    }));

    it('navega a media para resultados no reproducibles', () => {
        component.select({ id: 8, title: 'Recording', originalTitle: null, year: null, posterUrl: null, kind: 'VIDEO', status: 'READY', playable: false });

        expect(router.navigate).toHaveBeenCalledWith(['/media', 8]);
    });
});
